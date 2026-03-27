`foundry.toml`

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"

[rpc_endpoints]
tempo_moderato = "${TEMPO_RPC_URL}"

# Optional: nicer per-chain defaults for scripts/tests
[fmt]
line_length = 100
bracket_spacing = true
```

`.env`

```bash
export TEMPO_RPC_URL="https://rpc.moderato.tempo.xyz"
export PRIVATE_KEY="0xyour_private_key"
export ACCOUNT_ADDRESS="0xyour_wallet_address"

# pathUSD is the standard test token commonly used for fees on Tempo docs/tooling
export TEMPO_FEE_TOKEN="0x20c0000000000000000000000000000000000000"
```

Tempo Moderato’s public RPC is `https://rpc.moderato.tempo.xyz`, the chain ID is `42431`, and Tempo uses stablecoin fee payment rather than a native gas token. Chainstack’s Tempo tooling page lists `pathUSD` at `0x20c0000000000000000000000000000000000000`, and Foundry’s chain registry includes the alias `tempo_moderato` for chain `42431`. ([Chainstack][1])

Install the Tempo-enabled Foundry build, because Tempo’s fork adds `--tempo.fee-token` support to `forge` and `cast`. ([GitHub][2])

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup -n tempo
```

Create a project and load env vars:

```bash
forge init my-tempo-app
cd my-tempo-app
source .env
```

Fund your wallet on Moderato:

```bash
cast rpc tempo_fundAddress $ACCOUNT_ADDRESS --rpc-url $TEMPO_RPC_URL
```

The public testnet faucet method is `tempo_fundAddress`, documented by Tempo for Moderato. ([GitHub][2])

A minimal deploy command looks like this:

```bash
forge create src/Counter.sol:Counter \
  --rpc-url tempo_moderato \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --tempo.fee-token $TEMPO_FEE_TOKEN
```

And a script deploy:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url tempo_moderato \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --tempo.fee-token $TEMPO_FEE_TOKEN
```

That `--tempo.fee-token` flag is the Tempo-specific piece that tells Foundry which TIP-20 stablecoin to use for fees. ([GitHub][2])

For forked tests:

```bash
forge test --fork-url tempo_moderato -vvv
```

Because `tempo_moderato` is already recognized in Foundry chain metadata, this alias works cleanly with the Moderato RPC endpoint when you define it in `foundry.toml`. ([GitHub][3])

If you want a ready-to-paste starter, here is a minimal `script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

contract Counter {
    uint256 public number;

    function setNumber(uint256 newNumber) external {
        number = newNumber;
    }
}

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        new Counter();
        vm.stopBroadcast();
    }
}
```

One practical note: if you only use upstream vanilla Foundry, Tempo-specific fee-token handling will be missing; Tempo’s own Foundry fork is the supported route right now, though the project states it is a temporary fork while upstream integration progresses. ([GitHub][2])


[1]: https://docs.chainstack.com/docs/tempo-tooling "Tempo tooling - Chainstack"
[2]: https://github.com/tempoxyz/tempo-foundry "GitHub - tempoxyz/tempo-foundry: Temporary fork of Foundry with Tempo support · GitHub"
[3]: https://github.com/foundry-rs/forge-std/blob/master/src/StdChains.sol "forge-std/src/StdChains.sol at master · foundry-rs/forge-std · GitHub"
