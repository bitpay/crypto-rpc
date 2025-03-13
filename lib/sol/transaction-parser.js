const SolComputeBudget = require('@solana-program/compute-budget');
const SolMemo = require('@solana-program/memo');
const SolSystem = require('@solana-program/system');
const SolToken = require('@solana-program/token');

const parseInstructions = (instructions) => {
  const parsedInstructions = {};
  let unknownInstructionCounter = 0;
  for (const instruction of instructions) {
    if (instruction.programAddress === SolSystem.SYSTEM_PROGRAM_ADDRESS) {
      const parsedInstruction = parseSystemProgramInstruction(instruction);
      Object.assign(parsedInstructions, parsedInstruction);
    } else if (instruction.programAddress === SolMemo.MEMO_PROGRAM_ADDRESS) {
      // Use the imported parser function
      const parsedInstruction = parseMemoProgramInstruction(instruction);
      Object.assign(parsedInstructions, parsedInstruction);
    } else if (instruction.programAddress === SolToken.ASSOCIATED_TOKEN_PROGRAM_ADDRESS) {
      // Use the imported parser function
      const parsedInstruction = parseAssociatedTokenProgramInstruction(instruction);
      Object.assign(parsedInstructions, parsedInstruction);
    } else if (instruction.programAddress === SolComputeBudget.COMPUTE_BUDGET_PROGRAM_ADDRESS) {
      // Use the imported parser function
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
  if (identifiedTokenInstruction === SolToken.TokenInstruction.Transfer) {
    const parsedTransferTokenInstruction = SolToken.parseTransferInstruction(instruction);
    parsedInstruction['transferToken'] = parsedTransferTokenInstruction;
  } else if (identifiedTokenInstruction === SolToken.TokenInstruction.TransferChecked) {
    const parsedTransferCheckedTokenInstruction = SolToken.parseTransferCheckedInstruction(instruction);
    parsedInstruction['transferCheckedToken'] = parsedTransferCheckedTokenInstruction;
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

