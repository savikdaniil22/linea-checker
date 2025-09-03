# Linea Allocation Checker

This script allows you to check **Linea token allocations** for a list of wallet addresses and save the results to a CSV file.

## Library used
- [ethers.js v6](https://docs.ethers.org/)

Install it before running the script:
```
npm i ethers
```

## Setup

Inside the script you will find an array of addresses:
```
let addresses = [
  "your address1",
  "your address2",
  "your address3",
  // ...
];
```
Replace these with the wallet addresses you want to check.

## Run
Run the script with Node.js:
```
node linea-allocations.mjs
```
After execution, a file called allocations.csv will be created.
-First column → wallet address
-Second column → number of tokens (integer, fractional part removed)

## Cleanup
After you process the results, you can delete the file:
```
rm allocations.csv
```
