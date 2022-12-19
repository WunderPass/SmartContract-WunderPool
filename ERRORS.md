# Error Codes

## Pool Errors (100)

| Code | Error Message                                | Description                                                                     |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| 100  | 100: Invalid Join Amount                     | Occurs at Creation when Invest is lower than minInvest or higher than maxInvest |
| 101  | 101: Pool already Exists                     | Should never occur                                                              |
| 102  | 102: Invalid Voting Threshold (0-100)        | Occurs at creation or update when param is invalid                              |
| 103  | 103: Invalid Voting Time                     | Occurs at creation or update when param is invalid                              |
| 104  | 104: Invalid MaxMembers                      | Occurs at creation or update when param is invalid                              |
| 105  | 105: Invalid minYesVoters                    | Occurs at creation or update when param is invalid                              |
| 106  | 106: Invalid minInvest                       | Occurs at creation or update when param is invalid                              |
| 107  | 107: maxInvest must be larger than minInvest |                                                                                 |
| 108  | 108: Only Pool                               | Is thrown at functions that can only be called by the pool                      |
| 109  | 109: Cannot be executed by the Pool          | Is thrown at functions that cant be called by the pool                          |
| 110  | 110: Pool Closed                             | Occurs when Member joins or funds Pool and Pool is closed                       |
| 111  | 111: Cannot be liquidated                    | Occurs when liquidatePool() is called before autoLiquidateTime has expired      |

## Member Errors (200)

| Code | Error Message                       | Description                                                               |
| ---- | ----------------------------------- | ------------------------------------------------------------------------- |
| 200  | 200: Stake is lower than minInvest  |                                                                           |
| 201  | 201: Stake is higher than maxInvest |                                                                           |
| 202  | 202: Member Limit reached           |                                                                           |
| 203  | 203: Not a Member                   |                                                                           |
| 204  | 204: Already Member                 |                                                                           |
| 205  | 205: Secret Already Used            | When creating a secret Invite Link with an already used secret            |
| 206  | 206: Invalid Signature              | Thrown when the signature is wrong (basically all "...ForUser" functions) |
| 207  | 207: Not On Whitelist               | When trying to join in a private Pool without being invited               |
| 208  | 208: MaxInvest reached              | When increasing your stake (fundPool) and exceeding maxInvest             |

## Proposal Errors (300)

| Code | Error Message                            | Description                                                                  |
| ---- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| 300  | 300: Inconsistent amount of transactions | When creating a Proposal with inconsistent array lengths                     |
| 301  | 301: Missing Title                       |                                                                              |
| 302  | 302: Missing Address                     |                                                                              |
| 303  | 303: Missing Action                      |                                                                              |
| 304  | 304: Only Members can vote               |                                                                              |
| 305  | 305: Proposal does not exist             |                                                                              |
| 306  | 306: Voting period has ended             |                                                                              |
| 307  | 307: Member has voted                    |                                                                              |
| 308  | 308: Invalid VoteType (1=YES, 2=NO)      |                                                                              |
| 309  | 309: Proposal already executed           |                                                                              |
| 310  | 310: Not enough Members voted yes        |                                                                              |
| 311  | 311: Majority voted against execution    |                                                                              |
| 312  | 312: Voting still allowed                |                                                                              |
| 313  | 313: Not enough funds                    | Thrown when the total TransactionValue would surpass the Pools MATIC Balance |
| 314  | 314: ${reason}                           | Proposal Execution failed with ${reason}                                     |

## Token Errors (400)

| Code | Error Message                | Description |
| ---- | ---------------------------- | ----------- |
| 400  | 400: Only Pool               |             |
| 401  | 401: Only Launcher           |             |
| 402  | 402: Could not transfer Fees |             |
| 403  | 403: Transfer Failed         |             |
| 404  | 404: NFT Transfer failed     |             |

## Distributor Errors (500)

| Code | Error Message                          | Description |
| ---- | -------------------------------------- | ----------- |
| 500  | 500: Event does not exist              |             |
| 501  | 501: Already Participant               |             |
| 502  | 502: Betting Phase Expired             |             |
| 503  | 503: Not allowed                       |             |
| 504  | 504: Event has not ended               |             |
| 505  | 505: Event already resolved            |             |
| 506  | 506: Event not yet resolved            |             |
| 507  | 507: Tournament already closed         |             |
| 508  | 508: Not approved                      |             |
| 509  | 509: Insufficient Balance              |             |
| 510  | 510: Tournament already closed         |             |
| 511  | 511: Mismatching Games and Predictions |             |
