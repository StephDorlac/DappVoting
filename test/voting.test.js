const Voting = artifacts.require("./Voting.sol");
const { assert } = require('chai');
const truffleAssert = require('truffle-assertions');

contract("Voting", accounts => {

  // Should Register accounts[1]-[3] From account[0]
  it("...should Register accounts[1] & [3] From account[0]", async () => {    
    const VotingInstance = await Voting.deployed();
    
    await VotingInstance.registeringUsers(accounts[1], { from: accounts[0] });
    const registeredUser = await VotingInstance.getVoter(accounts[1], { from: accounts[0] });
    
    assert.isTrue(registeredUser.isRegistered);

    await VotingInstance.registeringUsers(accounts[3], { from: accounts[0] });
    const secondUser = await VotingInstance.getVoter(accounts[3], { from: accounts[0] });    
     assert.isTrue(secondUser.isRegistered);
  });

  


  // Should NOT register twice accounts[1] from account[0]
  it("...should NOT register twice accounts[1] from account[0]", async () => {
    const VotingInstance = await Voting.deployed();  
    await truffleAssert.reverts(VotingInstance.registeringUsers(accounts[1], { from: accounts[0] }));
  });

  // Check workflow status after admin open Proposal Registration
  it("...workflowstatus should be ProposalsRegistrationStarted", async () => {
    const VotingInstance = await Voting.deployed();  
    
    const trx = await VotingInstance.openProposaRegistration({ from: accounts[0] });    
    const currentStatus = await VotingInstance.getCurrentWorkflowStatus();
    assert.equal(currentStatus, Voting.WorkflowStatus.ProposalsRegistrationStarted, "WorkflowStatus not correct");
  });

   // unregistred user cannot do a proposal
   it("...user[2] cannot do a proposal (not whitelisted by admin) - should fail", async () => {
     const VotingInstance = await Voting.deployed();    
     truffleAssert.reverts(VotingInstance.makeProposal("Propal Test from accounts[2]", {from: accounts[2]}));
   });

  
  //check event after proposal done
  it("...event ProposalRegistered should be emited", async () => {
    const VotingInstance = await Voting.deployed();
    const tx = await VotingInstance.makeProposal("Propal Test from accounts[1]", { from: accounts[1] });

    truffleAssert.eventEmitted(tx, 'ProposalRegistered');
  });

  //user allowed make a proposal
   it("...proposal should be recorded", async () => {
    const VotingInstance = await Voting.deployed();    
         
     let propBefore = await VotingInstance.getProposals({ from: accounts[1] });
     let countBefore = parseInt(propBefore.length);
     countBefore  = null ?? 0
     
     const tx = await VotingInstance.makeProposal("Propal Test from accounts[1]", { from: accounts[1] });
     
     let propAfter = await VotingInstance.getProposals({ from: accounts[1] })
     let countAfter = parseInt(propAfter.length);
     const isGreater = countAfter > countBefore;    
     assert.equal(isGreater, true, "proposal not recorded:" + countBefore + " - " + countAfter);
     
   });
  
  //admin close registration, allowed users cannot do a new proposal
  it("... should not permit to add proposal after closing session", async () => {
    const VotingInstance = await Voting.deployed();

    const txclose = await VotingInstance.closeProposalRegistration({ from: accounts[0] });
    
    truffleAssert.eventEmitted(txclose, 'ProposalsRegistrationEnded');
    truffleAssert.reverts(VotingInstance.makeProposal("Propal Test from accounts[1]", {from: accounts[1]}));
    
  });

  //user cannot vote before Vote session was opened
  it("...user cannot vote before Vote session was opened", async () => {
    const VotingInstance = await Voting.deployed();

    truffleAssert.reverts(VotingInstance.voteForProposal(0, { from: accounts[1] }));
  });

  //user hasvoted should be true
  it ("user hasvoted should be true", async () => {
    const VotingInstance = await Voting.deployed();

    const txOpenVote = await VotingInstance.openVoteSession({ from: accounts[0] });
    truffleAssert.eventEmitted(txOpenVote, 'VotingSessionStarted');

    let user = await VotingInstance.getVoter(accounts[1], { from: accounts[0] });
    assert.isFalse(user.hasVoted);

    const txVoteUser = await VotingInstance.voteForProposal(0, { from: accounts[1] });
    user = await VotingInstance.getVoter(accounts[1], { from: accounts[0] });
    assert.isTrue(user.hasVoted);

  });

  //user cannot vote twice
  it ("...user cannot vote twice", async () => {
    const VotingInstance = await Voting.deployed();

    truffleAssert.reverts(VotingInstance.voteForProposal(0, { from: accounts[1] }));
  });

  //user cannot vote after Vote session closed
  it("...user cannot vote after Vote session closed", async () => {
    const VotingInstance = await Voting.deployed();
    
    const txCloseVote = await VotingInstance.closeVoteSession({ from: accounts[0] });
    truffleAssert.eventEmitted(txCloseVote, 'VotingSessionEnded');
    truffleAssert.reverts( VotingInstance.voteForProposal(0, { from: accounts[3] }));
  });

  //admin process vote result, event should be emitted
  it ("admin process vote result, event should be emitted", async () => {
    const VotingInstance = await Voting.deployed();

    const txProcessResult = await VotingInstance.processVoteResults({ from: accounts[0] });
    truffleAssert.eventEmitted(txProcessResult, 'VotesTallied');       
  }); 
  

  //A winnig proposal should be returned
  it ("A winnig proposal should be returned", async () => {
    const VotingInstance = await Voting.deployed();

    const proposal = await VotingInstance.getWinningProposal({ from: accounts[1] });
    assert.isAbove(parseInt(proposal.voteCount), 0);
  });
  

 
});