import { E } from '@endo/far';
import deployConfig from './deploy-config.js';

const deployPegRemote = async homeP => {
  const {
    wallet,
    pegasusConnections,
    board,
    scratch,
    agoricNames,
    zoe
  } = E.get(homeP);

  const {
    akash: {
      remoteAsset
    }
  } = deployConfig;

  assert(pegasusConnections, `pegasusConnections power missing`);
  console.log('Awaiting pegasusConnections...');
  const connections = await E(pegasusConnections).entries();
  assert(connections.length > 0, `pegasusConnections nameHub is empty`);
  console.log('pegasusConnections:', connections.length);
  const [_, connection] = connections.find(([a, _c]) =>
    a.endsWith(deployConfig.agoric.channel),
  );

  const {
    actions
  } = connection;

  console.log('Creating a remote peg for uAKT...');
  const uaktPeg = await E(actions).pegRemote(
    remoteAsset.keyword,
    remoteAsset.denom,
    remoteAsset.assetKind,
    remoteAsset.displayInfo,
  );

  console.log('Writing the uAKT peg to scratch...');
  const uaktScratchId = await E(scratch).set(remoteAsset.pegId, uaktPeg);
  console.log('uAKT peg is successfully written to scratch with the id:', uaktScratchId);

  console.log('Fetching the local issuer for uAKT...');
  const pegasusInstanceP = E(agoricNames).lookup('instance', 'Pegasus');
  const pegPF = E(zoe).getPublicFacet(pegasusInstanceP);

  const localBrand = await E(uaktPeg).getLocalBrand();
  const localIssuer = await E(pegPF).getLocalIssuer(localBrand);

  console.log('Putting the local issuer to board...');
  const issuerBoardId = await E(board).getId(localIssuer);

  console.log('Suggesting the local issuer to walllet...');
  const walletB = E(wallet).getBridge();
  await E(walletB).suggestIssuer(
    remoteAsset.keyword,
    issuerBoardId,
  );

  console.log('Done.')
};

export default deployPegRemote;