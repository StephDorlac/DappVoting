import React, { Component } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import VotingContract from "./contracts/Voting.json";
import getWeb3 from "./getWeb3";

import Accordion from 'react-bootstrap/Accordion';
import Alert from 'react-bootstrap/Alert';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Stack from 'react-bootstrap/Stack';
import ListGroup from 'react-bootstrap/ListGroup';
import Table from 'react-bootstrap/Table';

import "./App.css";
import ListGroupItem from "react-bootstrap/esm/ListGroupItem";

class App extends Component {
  state = { web3: null, accounts: null, contract: null, isWeb3Error:null };

  componentDidMount = async () => {
   
    let isWeb3Error;
    try {
      
      isWeb3Error = false;

      // Get network provider and web3 instance.
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts (Metamask).
      const accounts = await web3.eth.getAccounts();

      // Get the Voting contract instance.
      const networkId = await web3.eth.net.getId();
      const deployedNetwork = VotingContract.networks[networkId];          

      const instance = new web3.eth.Contract(
        VotingContract.abi,
        deployedNetwork && deployedNetwork.address,
        
      ); 

      // Set web3, accounts, and contract to the state, and then proceed with runInit 
      this.setState({ web3, accounts, contract: instance, isWeb3Error }, this.runInit);

    } catch (error) {      
      isWeb3Error = true
      this.setState({isWeb3Error})
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`,
      );     
      console.error(error);
    }
  };

  //Initilazation
  runInit = async() => {
    const { contract } = this.state;

    // Get contract info     
    const contractOwner = await contract.methods.owner().call(); // The owner
    const currentWorkflowStatus = await contract.methods.getCurrentWorkflowStatus().call(); // current workflow status
    const proposals = await contract.methods.getProposals().call(); // proposals 
    const votersAdresses = await contract.methods.getVotersAdresses().call(); // addresses on wihtelist
    const winningProposal = await contract.methods.winningProposal().call(); // the winning proposal

    let contractInformation = {
        contractOwner: contractOwner,
        currentWorkflowStatus: currentWorkflowStatus,
        proposals: proposals,
        votersAdresses: votersAdresses,
        winningProposal: winningProposal,        
    };
    
    this.setState({ contractInformation });
    this.setAccountInformation();
    this.getUIWorkflowStatus();

    // ********** Events management **********
    window.ethereum.on('accountsChanged', (accounts) => this.handleAccountsChanged(accounts));
    contract.events.WorkflowStatusChange().on('data', (event) => this.handleWorkflowStatusChange(event))
                                          .on('error', (error) => console.error(error));
    contract.events.VoterRegistered().on('data', (event) => this.handleVoterAdded(event))
                                     .on('error', (error) => console.error(error));
    contract.events.ProposalRegistered().on('data', (event) => this.handleProposalRegistered(event))
                                        .on('error', (error) => console.error(error));     
    contract.events.Voted().on('data', (event) => this.handleVoted(event))
                           .on('error', (error) => console.error(error));
  }

  // Connected account (Need to be call at start and when user change metamastk account !)
  setAccountInformation = async() => {
    const { accounts, contract, contractInformation, web3 } = this.state;
    const connectedAccount = accounts[0];

    const voterInformation = await contract.methods.getVoter(connectedAccount).call(); 
    const canVote = voterInformation && voterInformation.isRegistered && !voterInformation.hasVoted;
    const isOwner = connectedAccount === contractInformation.contractOwner ? true : false;
    const isRegistered = voterInformation && voterInformation.isRegistered;
    const hasVoted = voterInformation && voterInformation.hasVoted; 
   
    let accountInformation = {
      account: connectedAccount,
      canVote: canVote,
      hasVoted: hasVoted,
      isOwner: isOwner,
      isRegistered: isRegistered,     
    };
    this.setState({ accountInformation });   
  };


  getUIWorkflowStatus() {
    const { contractInformation } = this.state;

    let UIWorkflowStatus
    switch (contractInformation.currentWorkflowStatus) {
      case '0':
        UIWorkflowStatus = "RegisteringVoters";
        break;
      case '1':
        UIWorkflowStatus = "ProposalsRegistrationStarted";
        break;
      case '2':
        UIWorkflowStatus = "ProposalsRegistrationEnded";
        break;
      case '3':
        UIWorkflowStatus = "VotingSessionStarted";
        break;
      case '4':
        UIWorkflowStatus = "VotingSessionEnded";
        break;
      case '5':
        UIWorkflowStatus = "VotesTallied";
        break;
    }
    this.setState({ UIWorkflowStatus });
  }

  // ========== Handles events ==========
  
  // Account change on Metamask
  handleAccountsChanged = async(newAccounts) => {
    const { web3 } = this.state;
    const reloadedAccounts = await web3.eth.getAccounts();   
    this.setState({ accounts: reloadedAccounts });
    this.setAccountInformation();
  }

  // Workflow change
  handleWorkflowStatusChange = async(event) => {  
    const { contract, contractInformation } = this.state;
    contractInformation.currentWorkflowStatus = event.returnValues.newStatus;    
    this.getUIWorkflowStatus();
  }

  //Voter added
  handleVoterAdded = async(event) => {    
    const { contract, contractInformation } = this.state;
    contractInformation.votersAdresses = await contract.methods.getVotersAdresses().call(); 
    this.setState({ contractInformation });    
  }

  //Proposal registred
  handleProposalRegistered = async(event) => {    
    this.listAllProposals();
  }

  //Vote done
  handleVoted = async(event) => {    
    this.listAllProposals();
  }

// ============== Contract interactions =================

  // Add account
  registeringUsers = async () => {
    try {

      const { accounts, contract } = this.state;
      const address = this.address.value;

      await contract.methods.registeringUsers(address).send({ from: accounts[0] }).then(response => {
        alert('Enregistrement réussi', "ENREGISTREMENT");
        this.address.value = '';
      })
    } catch (error) {
      alert(error, "ERREUR");
    }
  }

  // Open registration
  openProposaRegistration = async () => {
    try {
      const { accounts, contract } = this.state;
      await contract.methods.openProposaRegistration().send({ from: accounts[0] }).then(response => {
        alert('Ouverture des enregistrements pour propositions', "SESSION PREOPOSITIONS");
      });
    } catch (error) {
      alert(error, "ERREUR");
    }
  }

  // Make a proposal
  makeProposal = async() => {
    try{
      const { accounts, contract } = this.state;
      const description = this.proposal.value;

      await contract.methods.makeProposal(description).send({ from: accounts[0] }).then(response =>{
        alert("Proposition enregistrée","ENREGISTREMENT");
      })
    }catch (error) {
      alert(error, "ERREUR");
    }
  }

  //List all proposals
  listAllProposals = async () => {
    try {
      const { contract, contractInformation } = this.state;
      contractInformation.proposals = await contract.methods.getProposals().call();
      this.setState({ contractInformation });
      this.setAccountInformation();
    } catch (error) {
      alert(error, "ERREUR");
    }
  }

  //Close proposal session
  closeProposalRegistrationn = async () => {
    try {
      const { accounts, contract } = this.state;
      await contract.methods.closeProposalRegistration().send({ from: accounts[0] }).then(response => {
        alert('Fermeture des enregistrements pour propositions', "SESSION PREOPOSITIONS");
      });
    } catch (error) {
      alert(error, "ERREUR");
    }
  }

  //Open vote session
  openVote = async() => {
    try{
      const { accounts, contract } = this.state;
      await contract.methods.openVoteSession().send({ from: accounts[0] }).then(response => {
        alert('Ouverture du VOTE', "VOTE");
      });

    }catch (error) {
      alert(error, "ERREUR");
    }
  }

  //Close vote session
  closeVote = async () => {
    try {
      const { accounts, contract } = this.state;
      await contract.methods.closeVoteSession().send({ from: accounts[0] }).then(response => {
        alert('Fermeture du VOTE', "VOTE");
      });
    } catch (error) {
      alert(error, "ERREUR");
    }
  }

  //Vote action
  voteForProposal = async (index) => {
    try {
      //alert(index.target.value);
      const { accounts, contract } = this.state;
      await contract.methods.voteForProposal(index.target.value).send({from: accounts[0]}).then(response => {
       alert("Vote effectué");
      }).catch(error => {
        alert("ERREUR:"+error);
      });
    } catch (error) {
      alert(error, "ERREUR");
    }
  }

  // Process vote result
  processVoteResults = async () => {
    try {
      const { accounts, contract } = this.state;
      await contract.methods.processVoteResults().send({ from: accounts[0] }).then(response => {
        alert('Résultat du vote disponible !', "VOTE");
      });
    } catch (error) {
      alert(error, "ERREUR");
    }
  }

  // Clean current vote
  cleanVote = async() => {
    const { accounts, contract } = this.state;

    await contract.methods.cleanVote().send({from: accounts[0]}).then(response => {      
      this.runInit();
    }).catch(error => {
      alert(error, "ERREUR");
    });
  }

// **************************************** Render ****************************************

  render() {
    const { accounts, accountInformation, contractInformation, UIWorkflowStatus, isWeb3Error } = this.state;

    //Loading
    let divConnection = <Alert variant='info'>
      Loading Web3, accounts, and contract...
    </Alert>   
    if (!this.state.web3) {
      return divConnection
    }
      
    

    // ======== DEFINE ALL DIV SECTIONS ========

    //DIV User connection info 
    let divConnectionInfo = accountInformation ? 
      accountInformation.account + " ": 
      "Veuillez connecter un compte"
    
    //Contract info
    let isOwner = (accountInformation && accountInformation.isOwner)
    let isVoter = (accountInformation && accountInformation.canVote)    
    let isRegistrationOpen = (UIWorkflowStatus!=null && UIWorkflowStatus === "ProposalsRegistrationStarted") ? true : false
    let isVoteOpen = (UIWorkflowStatus!=null && UIWorkflowStatus === "VotingSessionStarted") ? true : false
    let isVoteTallied = (UIWorkflowStatus!=null && UIWorkflowStatus === "VotesTallied") ? true : false
    
    //DIV owner
    let divIsOwner = <span className='badge bg-success'>owner</span>

    //DIV workflowStatus
    let uiStatus = UIWorkflowStatus
    
    //DIV Admin buttons
    let divAdminButtons = <Card border="primary"><Card.Body>
      <Card.Title>Menu admin</Card.Title>
      
      <Button variant="primary" onClick={this.openProposaRegistration}>Ouvrir la session</Button>{' '}
      <Button variant="primary" onClick={this.closeProposalRegistrationn}>Fermer la session</Button>{' '}
      <Button variant="primary" onClick={this.openVote}>Ouvrir le vote </Button>{' '} 
      <Button variant="primary" onClick={this.closeVote}>Fermer le vote</Button>{' '}
      <Button variant="success" onClick={this.processVoteResults}>Resultat</Button>{' '}
      <Button variant="warning" onClick={this.cleanVote}>Reset du vote</Button>
    </Card.Body></Card>

    //DIV Add Voters
    let divAddVoter =  
    <Stack direction="horizontal" gap={3}>
      <Form.Group>
        <Form.Control type="text" id="address"
          ref={(input) => { this.address = input }}
        />
      </Form.Group>
      <Button onClick={this.registeringUsers}  >Ajouter un compte</Button>
      </Stack>
    
    //DIV Registered voters
    let divRegistreredVoters = <ListGroup variant="flush">       
      <ListGroup.Item>      
        <Table hover>      
          <tbody>
            {contractInformation && typeof (contractInformation.votersAdresses) !== 'undefined' && contractInformation.votersAdresses !== null &&
              contractInformation.votersAdresses.map((a) => <tr key={a.toString()}><td>{a}</td></tr>)
            }
          </tbody>
        </Table>
      </ListGroup.Item>
    </ListGroup>

    //DIV Add proposal
    let divAddProposal = <Stack direction="horizontal" gap={3}><Form className="w-50"> 
      <Form.Control type="text" id="proposal" placeholder="Votre proposition"
        ref={(input) => { this.proposal = input }}
      />        
    </Form>
    <Button onClick={this.makeProposal}  >Enregistrer</Button>
    </Stack>

    //DIV list proposals
    const tdButtonVote = (index) => {
      if (isVoter && isVoteOpen) {
        return <>
                 <Button onClick={ this.voteForProposal } value={index}>Voter</Button>&nbsp;
               </>;
      }else {
        return <></>;
      }
    }
    let divProposals = <ListGroup>
      <ListGroup.Item>
        <Table hover>
          <tbody>
            {contractInformation && contractInformation.proposals != null &&
              contractInformation.proposals.map((prop, index) => 
              <tr key={index}>               
              <td>Description: {prop.description} ({prop[1]} vote(s))</td>
              <td>{tdButtonVote(index)}</td>
              </tr>)
            }
          </tbody>
        </Table>
      </ListGroup.Item>
    </ListGroup>
    
    //DIV divResult
    let divResult = <Accordion.Item eventKey="2"align="center" >
      <Accordion.Header>Résultat du vote</Accordion.Header>
      <Accordion.Body>
        <Card style={{ width: '18rem' }}>
          <Card.Body>
            <Card.Title>Résultat du vote</Card.Title>
            <Card.Text>
           {contractInformation !=null  && contractInformation.winningProposal? 
           contractInformation.winningProposal[0] + "(" + contractInformation.winningProposal[1] + " votes)": 
           ""}            
            </Card.Text>
          </Card.Body>
        </Card>
      </Accordion.Body>
    </Accordion.Item>




    // ======== DISPLAY RENDER ========
    return (
      <div className="App">        
        <h1>VOTING DAPP</h1>
        <h2>ALYRA DEFI 02</h2>

        {/* Header*/}
        <Card>
          <Card.Header>Status actuel : {uiStatus}</Card.Header>
          <Card.Body>
            <Card.Title>{divConnectionInfo}{isOwner ? divIsOwner
              :
              ""}</Card.Title>
            <Card.Text>
              {isOwner ?
                "Vous êtes l'administrateur, vous gérez les votes" :
                "Le système de vote est géré par un administrateur"}
            </Card.Text>
            {isOwner ? divAdminButtons : ""}
          </Card.Body>
        </Card>

        {/* Voters list section */}
        <Accordion >
        {isVoteTallied ? divResult:null}       
          <Accordion.Item eventKey="0">
            <Accordion.Header>Liste des votants</Accordion.Header>
            <Accordion.Body>
              {isOwner ? divAddVoter : ""}
              {divRegistreredVoters}
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>Liste des propositions</Accordion.Header>
            <Accordion.Body>
              {isVoter && isRegistrationOpen ? divAddProposal : ""}
              {divProposals}
            </Accordion.Body>
          </Accordion.Item>           
        </Accordion>



      </div>
    );
  }
}

export default App;
