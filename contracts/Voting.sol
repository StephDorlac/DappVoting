// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

//External libs
import "@OpenZeppelin/contracts/access/Ownable.sol";

/// @title Formation Alyra "Défi 02 - Système de vote"
/// @author Stéphane Dorlac
contract Voting is Ownable {
    // ======  Entities  ======
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 votedProposalId;
    }

    struct Proposal {
        string description;
        uint256 voteCount;
    }

    // ====== Enumerations ======
    enum WorkflowStatus {
        RegisteringVoters,
        ProposalsRegistrationStarted,
        ProposalsRegistrationEnded,
        VotingSessionStarted,
        VotingSessionEnded,
        VotesTallied
    }

    // ====== variables ======
    mapping(address => Voter) private _voters; //only users in whitelist can propose and vote
    address[] private votersAddresses;
    uint256 winningProposalId;
    Proposal public winningProposal;
    Proposal[] public proposals;
    WorkflowStatus _workflowStatus;

    // ====== Events ======
    event VoterRegistered(address voterAddress);
    event ProposalsRegistrationStarted();
    event ProposalsRegistrationEnded();
    event ProposalRegistered(uint256 proposalId);
    event VotingSessionStarted();
    event VotingSessionEnded();
    event Voted(address voter, uint256 proposalId);
    event VotesTallied();
    event WorkflowStatusChange(
        WorkflowStatus previousStatus,
        WorkflowStatus newStatus
    );

    // ************************************************************ Functions ************************************************************

    // Admin only can add users in whitelist
    function registeringUsers(address _address) public onlyOwner {
        require(!_voters[_address].isRegistered, "Existing Address !");

        require(
            _workflowStatus != WorkflowStatus.ProposalsRegistrationStarted &&
                _workflowStatus != WorkflowStatus.ProposalsRegistrationEnded &&
                _workflowStatus != WorkflowStatus.VotingSessionStarted &&
                _workflowStatus != WorkflowStatus.VotingSessionEnded
        );

        _workflowStatus = WorkflowStatus.RegisteringVoters;

        Voter memory voter = Voter(true, false, 0);
        _voters[_address] = voter;

        votersAddresses.push(_address);

        //fire event
        emit VoterRegistered(_address);
    }

    // function cleanVote allow admin to clean current vote
    // Admin only can open proposal session
    function cleanVote() public onlyOwner {
        delete winningProposal;
        delete proposals;

        //to clean mapping we need to clean its values
        uint256 counter;
        for (counter = 0; counter < votersAddresses.length; counter++) {
            delete _voters[votersAddresses[counter]];
        }
        delete votersAddresses;

        //Reset Workflow
        _workflowStatus = WorkflowStatus.RegisteringVoters;
    }

    // function openProposaRegistration allow admin to open the Proposal registration
    // Admin only can open proposal session
    // Warning : openProposaRegistration remove proposals and voters !
    function openProposaRegistration() public onlyOwner {
        _workflowStatus = WorkflowStatus.ProposalsRegistrationStarted; //open registration

        //Clean up the new Proposal session
        delete proposals; //clean proposals to start the new proposal registration

        //fire Events
        emit ProposalsRegistrationStarted();
        emit WorkflowStatusChange(
            WorkflowStatus.ProposalsRegistrationEnded,
            WorkflowStatus.ProposalsRegistrationStarted
        );
    }

    // function closeProposalRegistration allow admin to close the Proposal registration
    // Admin only can close proposal session
    function closeProposalRegistration() public onlyOwner {
        require(
            _workflowStatus == WorkflowStatus.ProposalsRegistrationStarted,
            "Session need to be opened !"
        );
        require(
            proposals.length > 0,
            "Cannot close Session without proposal !"
        );

        _workflowStatus = WorkflowStatus.ProposalsRegistrationEnded; //close registration

        //fire Events
        emit ProposalsRegistrationEnded();
        emit WorkflowStatusChange(
            WorkflowStatus.ProposalsRegistrationStarted,
            WorkflowStatus.ProposalsRegistrationEnded
        );
    }

    // User make a proposal
    // - description : string to set the proposal libelle
    function makeProposal(string memory description) public {
        require(
            _workflowStatus == WorkflowStatus.ProposalsRegistrationStarted,
            "Proposal Session not opened"
        ); //check if session is open by admin to make a proposal
        require(
            _voters[msg.sender].isRegistered,
            "Action not allowed for this address"
        ); //check if caller is allowed in whitelist

        Proposal memory prop = Proposal(description, 0);
        proposals.push(prop);

        emit ProposalRegistered(proposals.length);
    }

    // Admin only can open a vote session
    function openVoteSession() public onlyOwner {
        //require(_workflowStatus == WorkflowStatus.ProposalsRegistrationEnded, "Proposal Session need to be closed");

        _workflowStatus = WorkflowStatus.VotingSessionStarted;

        //fire Events
        emit VotingSessionStarted();
        emit WorkflowStatusChange(
            WorkflowStatus.ProposalsRegistrationEnded,
            WorkflowStatus.VotingSessionStarted
        );
    }

    // Admin only can close a vote session
    function closeVoteSession() public onlyOwner {
        require(
            _workflowStatus == WorkflowStatus.VotingSessionStarted,
            "Voting Session not started"
        );

        _workflowStatus = WorkflowStatus.VotingSessionEnded;

        //fire Events
        emit VotingSessionEnded();
        emit WorkflowStatusChange(
            WorkflowStatus.VotingSessionStarted,
            WorkflowStatus.VotingSessionEnded
        );
    }

    //Elector Vote for a selected proposal
    function voteForProposal(uint256 _proposalId) public {
        require(_voters[msg.sender].isRegistered, "User not whitelisted !"); //check if caller is allowed in whitelist
        require(
            _workflowStatus == WorkflowStatus.VotingSessionStarted,
            "Voting Session not started"
        );
        require(!_voters[msg.sender].hasVoted, "Vote alredy done"); //check if user has already vote for this session
        require(_proposalId <= proposals.length, "Proposal not found"); //check if _proposalId exists

        //Proposal receive a vote
        proposals[_proposalId].voteCount++;

        //Voter has now vote and cannot vote again
        _voters[msg.sender].hasVoted = true;

        //fire events
        emit Voted(msg.sender, _proposalId);
    }

    //Compute result after voting
    function processVoteResults() public onlyOwner {
        require(
            _workflowStatus == WorkflowStatus.VotingSessionEnded,
            "Voting Session not ended !"
        );

        _workflowStatus = WorkflowStatus.VotesTallied;

        //loop on proposals
        uint256 maxVotecount = 0;
        for (uint256 cptPr = 0; cptPr < proposals.length; cptPr++) {
            if (proposals[cptPr].voteCount > maxVotecount) {
                maxVotecount = proposals[cptPr].voteCount;
                winningProposalId = cptPr;

                winningProposal = proposals[winningProposalId];
            }
        }

        //fire events
        emit VotesTallied();
        emit WorkflowStatusChange(
            WorkflowStatus.VotingSessionEnded,
            WorkflowStatus.VotesTallied
        );
    }

    // Get the Winning proposal
    // Vote session need to be closed
    function getWinningProposal() public view returns (Proposal memory) {
        require(
            _workflowStatus == WorkflowStatus.VotesTallied,
            "Vote need to be Tallied"
        );

        return proposals[winningProposalId];
    }

    // Following functions are used for dapp

    // Return the current workflow status
    function getCurrentWorkflowStatus() public view returns (WorkflowStatus) {
        return _workflowStatus;
    }

    //Retrun proposals
    function getProposals() public view returns (Proposal[] memory) {
        return proposals;
    }

    //Return voters adresses
    function getVotersAdresses() public view returns (address[] memory) {
        return votersAddresses;
    }

    function getVoter(address _address) public view returns (Voter memory) {
        return _voters[_address];
    }
} // end of smart contract
