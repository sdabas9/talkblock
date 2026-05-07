/**
 * Barrel file — imports all per-contract guide files.
 * To add a new guide, create a file in ./guides/ and import it here.
 */

import type { ContractGuide } from "./index"
import { eosioSystem } from "./guides/eosio-system"
import { eosioToken } from "./guides/eosio-token"
import { eosioMsig } from "./guides/eosio-msig"
import { atomicassets } from "./guides/atomicassets"
import { telosDecide } from "./guides/telos-decide"
import { dgoods } from "./guides/dgoods"
import { resPink } from "./guides/res-pink"
import { thezeosalias } from "./guides/thezeosalias"
import { coreVaulta } from "./guides/core-vaulta"
import { swapDefi } from "./guides/swap-defi"
import { quickPowerup } from "./guides/quickpowerup"

export const GUIDES: ContractGuide[] = [
  eosioSystem,
  eosioToken,
  eosioMsig,
  atomicassets,
  telosDecide,
  dgoods,
  resPink,
  thezeosalias,
  coreVaulta,
  swapDefi,
  quickPowerup,
]
