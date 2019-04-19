# Asch contract examples

 A repository containing small examples to illustrate the use of asch contract
  for creating decentralized applications.

## Running tests

```bash
npm i
npm i -g npx
npm i -g create-asch-contract

create-asch-contract verify hello/hello.ts

npx jest
npx jest hello/hello.ts
```

## Included examples

- [hello](hello) - hello world examples
- [ballgame](ballgame) - ball game shows the usage of random usage
- [bancor](bancor) - bancor token exchange protocol example
- [cctime](cctime) - a content delivery and comment app
- [funding](funding) - coin offering
- [pixel](pixel) - million pixels game
- [puzzle](puzzle) - puzzle game to show the usage of hash function
- [exchange](exchange) - Order settlement, show the usage of ByteBuffer and signature verify
- [uniswap](uniswap) - uniswap protocol example