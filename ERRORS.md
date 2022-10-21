# Error Codes

## Pool Errors (100)

100: Invalid Join Amount
101: Pool already Exists
102: Invalid Voting Threshold (0-100)
103: Invalid Voting Time
104: Invalid MaxMembers
105: Invalid minYesVoters
106: Invalid minInvest
107: maxInvest must be larger than minInvest
108: Only Pool
109: Cannot be executed by the Pool
110: Pool Closed
111: Cannot be liquidated

## Member Errors (200)

200: Stake is lower than minInvest
201: Stake is higher than maxInvest
202: Member Limit reached
203: Invalid Signature
204: Not a Member
205: Already Member
206: Secret Already Used
207: Invalid Signature
208: Not On Whitelist
209: MaxInvest reached

## Proposal Errors (300)

300: Inconsistent amount of transactions
301: Missing Title
302: Missing Address
303: Missing Action
304: Only Members can vote
305: Proposal does not exist
306: Voting period has ended
307: Member has voted
308: Invalid VoteType (1=YES, 2=NO)
309: Proposal does not exist
310: Proposal already executed
311: Not enough Members voted yes
312: Majority voted against execution
313: Voting still allowed
314: Not enough funds
315: ${reason}

## Token Errors (400)

400: Only Pool
401: Only Launcher
402: Could not transfer Fees
403: Transfer Failed
404: NFT Transfer failed

## Distributor Errors (500)

500: Event does not exist
501: Already Participant
502: Betting Phase Expired
503: Not allowed
504: Event has not ended
505: Event already resolved
506: Event not yet resolved
507: Game already closed
508: Not approved
509: Insufficient Balance
