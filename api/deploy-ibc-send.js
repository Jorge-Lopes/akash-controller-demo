import { E } from '@endo/far';
import deployConfig from './deploy-config.js';

const deployIbcSenduAKT = async homeP => {
  const {
    agoricNames,
    scratch,
    wallet,
    zoe,
  } = E.get(homeP);

  console.log('Fetching pegasus publicFacet, uAKT peg and walletBridge...');
  const pegasusInstanceP = E(agoricNames).lookup('instance', 'Pegasus');

  const [pegPF, uaktPeg, walletBridge] = await Promise.all([
    E(zoe).getPublicFacet(pegasusInstanceP),
    E(scratch).get(deployConfig.akash.remoteAsset.pegId),
    E(wallet).getBridge(),
  ]);

  const transferInvitation = E(pegPF).makeInvitationToTransfer(
    uaktPeg,
    deployConfig.akash.address
  );

  const offerConfig = {
    invitation: transferInvitation,
    id: `${Date.now()}`,
    proposalTemplate: {
      give: {
        Transfer: {
          pursePetname: 'Akash',
          value: 1_000_000n,
        }
      }
    }
  };

  console.log('Making the offer to send uAKT to Akash...');
  await E(walletBridge).addOffer(offerConfig);

  console.log('Please check your wallet UI to approve the offer.')
};

export default deployIbcSenduAKT;