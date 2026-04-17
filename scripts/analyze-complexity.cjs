#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Analyzes code complexity metrics for the project
 */

// Patterns to count for cyclomatic complexity
const branchPatterns = [
  /\bif\b/g,
  /\belse\b/g,
  /\belse\s+if\b/g,
  /\bswitch\b/g,
  /\bcase\b/g,
  /\bdefault\b/g,
  /\bfor\b/g,
  /\bwhile\b/g,
  /\bdo\b/g,
  /\btry\b/g,
  /\bcatch\b/g,
  /\?\./g,  // optional chaining
  /\?[^:]/g, // ternary operator (first part)
  /:/g,     // ternary operator (second part) - will be filtered
  /&&/g,
  /\|\|/g,
];

/**
 * Count cyclomatic complexity by counting branch points
 */
function countCyclomaticComplexity(code) {
  let complexity = 1; // Base complexity

  // Count each pattern type
  const ifMatches = (code.match(/\bif\b/g) || []).length;
  const elseIfMatches = (code.match(/\belse\s+if\b/g) || []).length;
  const elseMatches = (code.match(/\belse\b/g) || []).length;
  const switchMatches = (code.match(/\bswitch\b/g) || []).length;
  const caseMatches = (code.match(/\bcase\b/g) || []).length;
  const forMatches = (code.match(/\bfor\b/g) || []).length;
  const whileMatches = (code.match(/\bwhile\b/g) || []).length;
  const doMatches = (code.match(/\bdo\b/g) || []).length;
  const tryMatches = (code.match(/\btry\b/g) || []).length;
  const catchMatches = (code.match(/\bcatch\b/g) || []).length;
  const ternaryMatches = (code.match(/\?[^:]/g) || []).length;
  const andMatches = (code.match(/&&/g) || []).length;
  const orMatches = (code.match(/\|\|/g) || []).length;

  complexity += ifMatches;
  complexity += elseIfMatches;
  complexity += switchMatches;
  complexity += caseMatches;
  complexity += forMatches;
  complexity += whileMatches;
  complexity += doMatches;
  complexity += catchMatches;
  complexity += ternaryMatches;
  complexity += andMatches;
  complexity += orMatches;

  return complexity;
}

/**
 * Find maximum nesting depth in code
 */
function findMaxNestingDepth(code) {
  let maxDepth = 0;
  let currentDepth = 0;
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Count opening braces/brackets/parentheses that increase nesting
    const openCount = (line.match(/[\{\[\(]/g) || []).length;
    const closeCount = (line.match(/[\}\]\)]/g) || []).length;

    // Also count keywords that increase nesting
    const keywordCount = (trimmed.match(/\b(if|else|for|while|switch|case|try|catch)\b/g) || []).length;

    currentDepth += openCount + keywordCount - closeCount;
    maxDepth = Math.max(maxDepth, currentDepth);
  }

  return maxDepth;
}

/**
 * Extract functions and their lengths
 */
function extractFunctions(code, filePath) {
  const functions = [];

  // Regex to match function declarations and expressions
  const patterns = [
    // Function declarations: function name() {}
    /function\s+(\w+)\s*\([^)]*\)\s*\{/g,
    // Arrow functions with explicit name: const name = () => {}
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>\s*\{/g,
    // Method definitions: methodName() {}
    /(\w+)\s*\([^)]*\)\s*\{/g,
    // Async functions: async function name() {}
    /async\s+function\s+(\w+)\s*\([^)]*\)\s*\{/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      const funcName = match[1];
      const startIndex = match.index;

      // Find matching closing brace
      let braceCount = 0;
      let foundOpenBrace = false;
      let endIndex = startIndex;

      for (let i = startIndex; i < code.length; i++) {
        if (code[i] === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (code[i] === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            endIndex = i;
            break;
          }
        }
      }

      const funcCode = code.substring(startIndex, endIndex + 1);
      const funcLines = funcCode.split('\n').length;

      functions.push({
        name: funcName,
        length: funcLines,
        code: funcCode,
        complexity: countCyclomaticComplexity(funcCode),
        nestingDepth: findMaxNestingDepth(funcCode)
      });
    }
  }

  return functions;
}

/**
 * Analyze a single file
 */
function analyzeFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const functions = extractFunctions(code, filePath);

    // Overall file metrics
    const fileComplexity = countCyclomaticComplexity(code);
    const fileMaxNestingDepth = findMaxNestingDepth(code);
    const lineCount = code.split('\n').length;

    // Find longest function
    const longestFunction = functions.reduce((max, func) =>
      func.length > max.length ? func : max, { length: 0, name: 'N/A' });

    // Find most complex function
    const mostComplexFunction = functions.reduce((max, func) =>
      func.complexity > max.complexity ? func : max, { complexity: 0, name: 'N/A' });

    return {
      filePath,
      lineCount,
      functions,
      functionCount: functions.length,
      fileComplexity,
      fileMaxNestingDepth,
      longestFunction,
      mostComplexFunction
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Get all source files recursively
 */
function getSourceFiles(dir, extensions = ['.js', '.ts', '.jsx', '.tsx']) {
  const files = [];

  function traverse(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // Skip node_modules, dist, build, and test directories
      if (entry.isDirectory() &&
          !['node_modules', 'dist', 'build', '.next', 'coverage', '__tests__', 'test'].includes(entry.name)) {
        traverse(fullPath);
      } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Main analysis function
 */
function analyzeProject() {
  const projectRoot = path.resolve(__dirname, '..');
  const backendDir = path.join(projectRoot, 'backend');
  const frontendDir = path.join(projectRoot, 'frontend');

  console.log('🔍 Analyzing code complexity...\n');

  const backendFiles = getSourceFiles(backendDir);
  const frontendFiles = getSourceFiles(frontendDir);
  const allFiles = [...backendFiles, ...frontendFiles];

  console.log(`Found ${allFiles.length} source files\n`);

  const results = [];

  for (const file of allFiles) {
    const analysis = analyzeFile(file);
    if (analysis) {
      results.push(analysis);
    }
  }

  // Sort by cyclomatic complexity
  const sortByComplexity = [...results].sort((a, b) => b.fileComplexity - a.fileComplexity);

  // Sort by nesting depth
  const sortByNesting = [...results].sort((a, b) => b.fileMaxNestingDepth - a.fileMaxNestingDepth);

  // Sort by function length
  const sortByLength = [...results].sort((a, b) => b.longestFunction.length - a.longestFunction.length);

  // Report results
  console.log('═'.repeat(80));
  console.log('📊 CODE COMPLEXITY ANALYSIS REPORT');
  console.log('═'.repeat(80));

  console.log('\n1️⃣  CYCLOMATIC COMPLEXITY (Top 20 most complex files)');
  console.log('═'.repeat(80));
  console.log('Cyclomatic complexity measures the number of independent paths through code.\n');

  sortByComplexity.slice(0, 20).forEach((result, index) => {
    const relativePath = path.relative(projectRoot, result.filePath);
    console.log(`\n${index + 1}. ${relativePath}`);
    console.log(`   Complexity Score: ${result.fileComplexity}`);
    console.log(`   Lines: ${result.lineCount}`);
    console.log(`   Functions: ${result.functionCount}`);
    if (result.mostComplexFunction.name !== 'N/A') {
      console.log(`   Most Complex Function: ${result.mostComplexFunction.name} (${result.mostComplexFunction.complexity})`);
    }

    // Show top 3 functions in this file
    if (result.functions.length > 0) {
      const topFuncs = [...result.functions]
        .sort((a, b) => b.complexity - a.complexity)
        .slice(0, 3);

      console.log(`   Top Functions:`);
      topFuncs.forEach((func, i) => {
        console.log(`     ${i + 1}. ${func.name}: complexity=${func.complexity}, lines=${func.length}`);
      });
    }
  });

  console.log('\n\n2️⃣  NESTING DEPTH ANALYSIS');
  console.log('═'.repeat(80));
  console.log('Files with nesting depth > 4 levels\n');

  const deepNestingFiles = sortByNesting.filter(r => r.fileMaxNestingDepth > 4);

  if (deepNestingFiles.length === 0) {
    console.log('✅ No files with nesting depth > 4');
  } else {
    console.log(`Found ${deepNestingFiles.length} files with deep nesting:\n`);

    deepNestingFiles.forEach((result, index) => {
      const relativePath = path.relative(projectRoot, result.filePath);
      console.log(`${index + 1}. ${relativePath}`);
      console.log(`   Max Nesting Depth: ${result.fileMaxNestingDepth} levels`);

      // Show functions with deepest nesting
      const deepFuncs = result.functions
        .filter(f => f.nestingDepth > 4)
        .sort((a, b) => b.nestingDepth - a.nestingDepth)
        .slice(0, 3);

      if (deepFuncs.length > 0) {
        console.log(`   Functions with deep nesting:`);
        deepFuncs.forEach((func, i) => {
          console.log(`     ${i + 1}. ${func.name}: ${func.nestingDepth} levels`);
        });
      }
      console.log('');
    });
  }

  console.log('\n3️⃣  FUNCTION LENGTH ANALYSIS');
  console.log('═'.repeat(80));
  console.log('Files containing functions longer than 100 lines\n');

  const longFunctionFiles = sortByLength.filter(r => r.longestFunction.length > 100);

  if (longFunctionFiles.length === 0) {
    console.log('✅ No functions longer than 100 lines');
  } else {
    console.log(`Found ${longFunctionFiles.length} files with long functions:\n`);

    longFunctionFiles.forEach((result, index) => {
      const relativePath = path.relative(projectRoot, result.filePath);
      console.log(`${index + 1}. ${relativePath}`);
      console.log(`   Longest Function: ${result.longestFunction.name} (${result.longestFunction.length} lines)`);

      // Show all functions > 50 lines
      const longFuncs = result.functions
        .filter(f => f.length > 50)
        .sort((a, b) => b.length - a.length);

      if (longFuncs.length > 1) {
        console.log(`   Other long functions:`);
        longFuncs.slice(1).forEach((func, i) => {
          console.log(`     ${i + 1}. ${func.name}: ${func.length} lines`);
        });
      }
      console.log('');
    });
  }

  console.log('\n4️⃣  SUMMARY STATISTICS');
  console.log('═'.repeat(80));

  const totalComplexity = results.reduce((sum, r) => sum + r.fileComplexity, 0);
  const avgComplexity = totalComplexity / results.length;

  const maxComplexity = Math.max(...results.map(r => r.fileComplexity));
  const maxNesting = Math.max(...results.map(r => r.fileMaxNestingDepth));
  const maxFuncLength = Math.max(...results.map(r => r.longestFunction.length));

  console.log(`Total Files Analyzed: ${results.length}`);
  console.log(`Total Complexity Score: ${totalComplexity}`);
  console.log(`Average Complexity per File: ${avgComplexity.toFixed(2)}`);
  console.log(`Highest Complexity Score: ${maxComplexity}`);
  console.log(`Highest Nesting Depth: ${maxNesting} levels`);
  console.log(`Longest Function: ${maxFuncLength} lines`);
  console.log(`Files with Deep Nesting (>4): ${deepNestingFiles.length}`);
  console.log(`Files with Long Functions (>100 lines): ${longFunctionFiles.length}`);

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Analysis Complete');
  console.log('═'.repeat(80));
}

// Run the analysis
analyzeProject();
