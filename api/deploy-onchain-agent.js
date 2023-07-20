import { E } from '@endo/far';
import { AmountMath } from '@agoric/ertp';
import { observeNotifier } from '@agoric/notifier';
import '@agoric/zoe/exported.js';
import deployConfig from './deploy-config.js';
import installationConstants from '../conf/installationConstants.js'; 

/**
 * @param {Promise<{zoe: ERef<ZoeService>, board: ERef<Board>, agoricNames:
 * object, wallet: ERef<object>, faucet: ERef<object>}>} homePromise
 */
const deployApi = async (homePromise, { installUnsafePlugin }) => {
  const { zoe, wallet, board, chainTimerService, scratch, agoricNames } = E.get(
    homePromise,
  );

  const {
    akash: {
      remoteAsset,
    },
    akashAccount,
  } = deployConfig;

  console.log('Finding the akt fund purse');
  const purseP = E(wallet).getPurse(remoteAsset.keyword);

  console.log('Finding the aktPeg, pegasus instance...');
  const [aktPeg, aktBrand, instance] = await Promise.all([
    E(scratch).get(remoteAsset.pegId),
    E(purseP).getAllegedBrand(),
    E(agoricNames).lookup('instance', 'Pegasus'),
  ]);

  assert(aktPeg, 'You may need to peg the `uakt` first');
  assert(aktBrand, `No purse ${remoteAsset.keyword} found`);
  const pegasus = await E(zoe).getPublicFacet(instance);
  const aktIssuer = await E(pegasus).getLocalIssuer(aktBrand);

  const mnemonic = akashAccount.mnemonic;
  const rpcEndpoint = akashAccount.rpcEndpoint;
  const deploymentId = akashAccount.dseq;

  assert(mnemonic, 'AKASH_MNEMNONIC env variables must not be empty');
  assert(rpcEndpoint, 'AKASH_RPC_ENDPOINT env variables must not be empty');
  assert(deploymentId, 'AKASH_WATCHED_DSEQ env variables must not be empty');

  const akashClient = await installUnsafePlugin('./src/akash.js', {
    mnemonic,
    rpcEndpoint,
  }).catch((e) => console.error(`${e}`));

  console.log('akashClient installed');

  const { INSTALLATION_BOARD_ID } = installationConstants;
  const installation = await E(board).getValue(INSTALLATION_BOARD_ID);

  const issuerKeywordRecord = harden({
    Fund: aktIssuer,
  });

  const timeAuthority = await chainTimerService;

  const terms = harden({
    akashClient,
    timeAuthority,
    minimalFundThreshold: 6_000_000n,
    depositValue: 5_000n,
    checkInterval: 15n,
    deploymentId,
    pegasus,
    aktPeg,
  });

  // start the contract
  const { creatorInvitation } = await E(zoe).startInstance(
    installation,
    issuerKeywordRecord,
    terms,
  );

  assert(creatorInvitation, 'Creator invitation must not be null');
  console.log('Controller instance started');

  // setup the Fund for this contract
  const amount = harden(AmountMath.make(aktBrand, 1_000n));
  const payment = await E(purseP).withdraw(amount);
  const proposal = harden({
    give: {
      Fund: amount,
    },
  });
  const paymentRecords = harden({
    Fund: payment,
  });

  console.log('Sending offer...');
  const seatP = E(zoe).offer(creatorInvitation, proposal, paymentRecords);

  observeNotifier(
    E(seatP).getAllocationNotifierJig(),
    harden({
      fail: (reason) => {
        console.log('Contract failed', reason);
      },
    }),
  );

  console.log('Waiting for result...');
  const result = await E(seatP).getOfferResult();
  console.log(result);

  console.log('Waiting for payout...');
  const payout = await E(seatP).getPayout('Fund');
  const remain = await E(aktIssuer).getAmountOf(payout);

  console.log('Remain amount', remain);

  if (!AmountMath.isEmpty(remain)) {
    await E(purseP).deposit(payout);
    console.log('Deposit back');
  }
};

export default deployApi;
