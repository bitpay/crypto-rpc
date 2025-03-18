const SolComputeBudget = require('@solana-program/compute-budget');
const SolMemo = require('@solana-program/memo');
const SolSystem = require('@solana-program/system');
const SolToken = require('@solana-program/token');
const solTokenProgramAddress = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

/**
 * @param {any[]} instructions 
 * @returns {Instructions}
 */
const parseInstructions = (instructions) => {
  const parsedInstructions = {};
  let unknownInstructionCounter = 0;
  for (const instruction of instructions) {
    if (instruction.programAddress === SolSystem.SYSTEM_PROGRAM_ADDRESS) {
      const parsedInstruction = parseSystemProgramInstruction(instruction);
      Object.assign(parsedInstructions, parsedInstruction);
    } else if (instruction.programAddress === SolMemo.MEMO_PROGRAM_ADDRESS) {
      const parsedInstruction = parseMemoProgramInstruction(instruction);
      Object.assign(parsedInstructions, parsedInstruction);
    } else if (instruction.programAddress === SolToken.ASSOCIATED_TOKEN_PROGRAM_ADDRESS) {
      const parsedInstruction = parseAssociatedTokenProgramInstruction(instruction);
      Object.assign(parsedInstructions, parsedInstruction);
    } else if (instruction.programAddress === solTokenProgramAddress) {
      const parsedInstruction = parseTokenProgramInstruction(instruction);
      Object.assign(parsedInstructions, parsedInstruction);
    } else if (instruction.programAddress === SolComputeBudget.COMPUTE_BUDGET_PROGRAM_ADDRESS) {
      const parsedInstruction = parseComputeBudgetProgramInstruction(instruction);
      Object.assign(parsedInstructions, parsedInstruction);
    } else {
      parsedInstructions[`unknownInstruction_${unknownInstructionCounter}`] = instruction;
      ++unknownInstructionCounter;
    }
  }
  return parsedInstructions;
};

const parseSystemProgramInstruction = (instruction) => {
  const identifiedInstruction = SolSystem.identifySystemInstruction(instruction);
  const parsedInstruction = {};
  if (identifiedInstruction === SolSystem.SystemInstruction.TransferSol) {
    const parsedTransferSolInstruction = SolSystem.parseTransferSolInstruction(instruction);
    const { accounts, data } = parsedTransferSolInstruction;
    const amount = Number(data.amount);
    const currency = 'SOL';
    const destination = accounts.destination.address;
    const source = accounts.source.address;
    parsedInstruction['transferSol'] = { amount, currency, destination, source };
  } else if (identifiedInstruction === SolSystem.SystemInstruction.AdvanceNonceAccount) {
    const parsedAdvanceNonceAccountInstruction = SolSystem.parseAdvanceNonceAccountInstruction(instruction);
    const { nonceAccount, nonceAuthority } = parsedAdvanceNonceAccountInstruction.accounts;
    parsedInstruction['advanceNonceAccount'] = {
      nonceAccount: nonceAccount.address,
      nonceAuthority: nonceAuthority.address
    };
  } else {
    parsedInstruction[`unparsedSystemInstruction_${identifiedInstruction}`] = instruction;
  }
  return parsedInstruction;
};

const parseMemoProgramInstruction = (instruction) => {
  const parsedInstruction = {};
  const parsedMemoInstruction = SolMemo.parseAddMemoInstruction({...instruction}); // Only one instruction with MEMO_PROGRAM_ADDRESS
  parsedInstruction['memo'] = parsedMemoInstruction.data;
  return parsedInstruction;
};

const parseAssociatedTokenProgramInstruction = (instruction) => {
  const parsedInstruction = {};
  const identifiedTokenInstruction = SolToken.identifyAssociatedTokenInstruction(instruction);
  parsedInstruction[`unparsedAssociatedTokenInstruction_${identifiedTokenInstruction}`] = instruction;
  return parsedInstruction;
};

const parseTokenProgramInstruction = (instruction) => {
  const parsedInstruction = {};
  const identifiedTokenInstruction = SolToken.identifyTokenInstruction(instruction);
  if (identifiedTokenInstruction === SolToken.TokenInstruction.Transfer) {
    const parsedTransferTokenInstruction = SolToken.parseTransferInstruction(instruction);
    const { accounts, data } = parsedTransferTokenInstruction;
    parsedInstruction['transferToken'] = {
      authority: accounts.authority.address,
      destination: accounts.destination.address,
      source: accounts.source.address,
      amount: Number(data.amount)
    };
  } else if (identifiedTokenInstruction === SolToken.TokenInstruction.TransferChecked) {
    const parsedTransferCheckedTokenInstruction = SolToken.parseTransferCheckedInstruction(instruction);
    const { accounts, data } = parsedTransferCheckedTokenInstruction;
    parsedInstruction['transferCheckedToken'] = {
      authority: accounts.authority.address,
      destination: accounts.destination.address,
      mint: accounts.mint.address,
      source: accounts.source.address,
      amount: Number(data.amount),
      decimals: data.decimals
    };
  } else {
    parsedInstruction[`unparsedTokenInstruction_${identifiedTokenInstruction}`] = instruction;
  }
  return parsedInstruction;
};

const parseComputeBudgetProgramInstruction = (instruction) => {
  const parsedInstruction = {};
  const identifiedComputeBudgetInstruction = SolComputeBudget.identifyComputeBudgetInstruction(instruction);
  if (identifiedComputeBudgetInstruction === SolComputeBudget.ComputeBudgetInstruction.SetComputeUnitLimit) {
    const parsedSetComputeUnitLimitInstruction = SolComputeBudget.parseSetComputeUnitLimitInstruction(instruction);
    parsedInstruction['setComputUnitLimit'] = {
      computeUnitLimit: parsedSetComputeUnitLimitInstruction.data.units
    };
  } else if (identifiedComputeBudgetInstruction === SolComputeBudget.ComputeBudgetInstruction.SetComputeUnitPrice) {
    const parsedSetComputeUnitPriceInstruction = SolComputeBudget.parseSetComputeUnitPriceInstruction(instruction);
    parsedInstruction['setComputeUnitPrice'] = {
      priority: true,
      microLamports: Number(parsedSetComputeUnitPriceInstruction.data.microLamports)
    };
  } else {
    parsedInstruction[`unparsedComputeBudgetInstruction_${identifiedComputeBudgetInstruction}`] = instruction;
  }
  return parsedInstruction;
};

module.exports = {
  parseInstructions
};

/**
 * @typedef {Object} TransferSolInstruction
 * @property {number} amount - Amount of SOL to transfer in lamports
 * @property {'SOL'} currency - Currency type, always "SOL"
 * @property {string} destination - Destination wallet address
 * @property {string} source - Source wallet address
 */

/**
 * @typedef {Object} AdvanceNonceAccountInstruction
 * @property {string} nonceAccount - Address of the nonce account
 * @property {string} nonceAuthority - Address of the nonce authority
 */

/**
 * @typedef {Object} SetComputeUnitLimitInstruction
 * @property {number} computeUnitLimit - Maximum compute units allowed
 */

/**
 * @typedef {Object} SetComputeUnitPriceInstruction
 * @property {true} priority - Whether this is a priority transaction
 * @property {number} microLamports - Price in micro-lamports per compute unit
 */

/**
 * @typedef {Object} MemoInstruction
 * @property {string} memo - Memo text content
 */

/**
 * @typedef {Object} TransferCheckedTokenInstruction
 * @property {number} amount
 * @property {string} authority
 * @property {number} decimals
 * @property {string} destination
 * @property {string} mint
 * @property {string} source
 */

/**
 * @typedef {Object} TransferTokenInstruction
 * @property {number} amount
 * @property {string} authority
 * @property {string} destination
 * @property {string} source
 */

/**
 * May also include additional unknown instructions
 * @typedef {Object} Instructions
 * @property {TransferSolInstruction} [transferSol]
 * @property {AdvanceNonceAccountInstruction} [advanceNonceAccount]
 * @property {SetComputeUnitLimitInstruction} [setComputeUnitLimit]
 * @property {SetComputeUnitPriceInstruction} [setComputeUnitPrice]
 * @property {MemoInstruction} [memo]
 * @property {TransferCheckedTokenInstruction} [transferCheckedToken]
 * @property {TransferTokenInstruction} [transferToken]
 */