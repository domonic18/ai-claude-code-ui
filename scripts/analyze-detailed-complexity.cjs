#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Enhanced complexity analysis with better function extraction
 */

/**
 * Count cyclomatic complexity more accurately
 */
function countCyclomaticComplexity(code) {
  let complexity = 1; // Base complexity

  // Remove strings and comments to avoid false positives
  const cleaned = code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g, '') // Remove strings
    .replace(/\?\./g, '  '); // Neutralize optional chaining (not a branch)

  // Count standalone `if` (but NOT `else if`, counted separately below)
  const allIf = (cleaned.match(/\bif\b/g) || []).length;
  const elseIf = (cleaned.match(/\belse\s+if\b/g) || []).length;
  complexity += elseIf; // each `else if` is one branch
  complexity += (allIf - elseIf); // standalone `if` (not preceded by `else`)

  const decisions = [
    /\bswitch\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcatch\b/g,
    /\?\?/g, // nullish coalescing
    /\?[^:.]/g, // ternary (exclude `?.` and `?:` TS annotation)
    /&&/g,
    /\|\|/g,
  ];

  for (const pattern of decisions) {
    const matches = cleaned.match(pattern);
    if (matches) complexity += matches.length;
  }

  // Count case statements (they're branches)
  const caseMatches = cleaned.match(/\bcase\b/g);
  if (caseMatches) complexity += caseMatches.length;

  return complexity;
}

/**
 * Find maximum nesting depth based on brace levels only.
 * Tracks per-function depth by resetting at top-level close-brace.
 */
function findMaxNestingDepth(code) {
  let maxDepth = 0;

  // Remove strings and comments
  const cleaned = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g, '');

  // Track depth per top-level block (function/class/method)
  let depth = 0;
  let blockMax = 0;

  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      depth++;
      blockMax = Math.max(blockMax, depth);
    } else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0 && blockMax > 0) {
        // End of a top-level block — record its peak
        maxDepth = Math.max(maxDepth, blockMax);
        blockMax = 0;
      }
    }
  }

  return maxDepth;
}

/**
 * Extract functions with better regex patterns
 */
function extractFunctions(code, filePath) {
  const functions = [];

  // Patterns for different function types
  const patterns = [
    {
      // function name() {}
      regex: /function\s+(\w+)\s*\([^)]*\)\s*\{/g,
      type: 'declaration'
    },
    {
      // const name = function() {}
      regex: /(?:const|let|var)\s+(\w+)\s*=\s*function\s*\([^)]*\)\s*\{/g,
      type: 'expression'
    },
    {
      // const name = () => {}
      regex: /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>\s*\{/g,
      type: 'arrow'
    },
    {
      // async function name() {}
      regex: /async\s+function\s+(\w+)\s*\([^)]*\)\s*\{/g,
      type: 'async'
    },
    {
      // Class methods: methodName() {}
      regex: /(\w+)\s*\([^)]*\)\s*\{[^}]*(?:this|\w+)\s*[,)]/g,
      type: 'method'
    }
  ];

  for (const { regex, type } of patterns) {
    let match;
    regex.lastIndex = 0; // Reset regex

    while ((match = regex.exec(code)) !== null) {
      const funcName = match[1];
      const startIndex = match.index;

      // Find matching closing brace
      let braceCount = 0;
      let foundOpenBrace = false;
      let endIndex = startIndex;
      const openBraceIndex = code.indexOf('{', startIndex);

      if (openBraceIndex === -1) continue;

      for (let i = openBraceIndex; i < code.length; i++) {
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

      if (endIndex > startIndex) {
        const funcCode = code.substring(startIndex, endIndex + 1);
        const funcLines = funcCode.split('\n').length;

        // Skip if already extracted (avoid duplicates)
        const isDuplicate = functions.some(f =>
          f.name === funcName && f.startIndex === startIndex
        );

        if (!isDuplicate) {
          functions.push({
            name: funcName,
            type,
            length: funcLines,
            startIndex,
            complexity: countCyclomaticComplexity(funcCode),
            nestingDepth: findMaxNestingDepth(funcCode)
          });
        }
      }
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

    // Find deepest function
    const deepestFunction = functions.reduce((max, func) =>
      func.nestingDepth > max.nestingDepth ? func : max, { nestingDepth: 0, name: 'N/A' });

    return {
      filePath,
      lineCount,
      functions,
      functionCount: functions.length,
      fileComplexity,
      fileMaxNestingDepth,
      longestFunction,
      mostComplexFunction,
      deepestFunction
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get all source files recursively
 */
function getSourceFiles(dir, extensions = ['.js', '.ts', '.jsx', '.tsx']) {
  const files = [];

  function traverse(currentPath) {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory() &&
            !['node_modules', 'dist', 'build', '.next', 'coverage', '__tests__', 'test', '.git'].includes(entry.name)) {
          traverse(fullPath);
        } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
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

  console.log('Analyzing code complexity...\n');

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

  // Sort by different metrics
  const sortByComplexity = [...results].sort((a, b) => b.fileComplexity - a.fileComplexity);
  const sortByNesting = [...results].sort((a, b) => b.fileMaxNestingDepth - a.fileMaxNestingDepth);
  const sortByFunctionLength = [...results].sort((a, b) => b.longestFunction.length - a.longestFunction.length);

  // Report results
  console.log('═'.repeat(100));
  console.log('CODE COMPLEXITY ANALYSIS REPORT');
  console.log('═'.repeat(100));

  console.log('\n1. CYCLOMATIC COMPLEXITY (Top 20 most complex files)');
  console.log('═'.repeat(100));
  console.log('Cyclomatic complexity measures the number of independent paths through code.\n');
  console.log('Thresholds:\n  1-10: Simple\n 11-20: Moderate\n 21-50: Complex\n 51+: Very Complex\n');

  sortByComplexity.slice(0, 20).forEach((result, index) => {
    const relativePath = path.relative(projectRoot, result.filePath);
    console.log(`\n${index + 1}. ${relativePath}`);
    console.log(`   Complexity: ${result.fileComplexity} | Lines: ${result.lineCount} | Functions: ${result.functionCount}`);

    if (result.mostComplexFunction.name !== 'N/A') {
      console.log(`   Most Complex: ${result.mostComplexFunction.name} (${result.mostComplexFunction.complexity})`);
    }

    // Show top 3 functions by complexity
    if (result.functions.length > 0) {
      const topFuncs = [...result.functions]
        .sort((a, b) => b.complexity - a.complexity)
        .slice(0, 3);

      console.log(`   Top Functions by Complexity:`);
      topFuncs.forEach((func, i) => {
        const complexityLevel = func.complexity > 50 ? 'CRITICAL' : func.complexity > 20 ? 'HIGH' : func.complexity > 10 ? 'MODERATE' : 'OK';
        console.log(`     ${i + 1}. ${func.name}: complexity=${func.complexity}, lines=${func.length}, depth=${func.nestingDepth} [${complexityLevel}]`);
      });
    }
  });

  console.log('\n\n2. NESTING DEPTH ANALYSIS');
  console.log('═'.repeat(100));
  console.log('Files with nesting depth > 4 levels\n');

  const deepNestingFiles = sortByNesting.filter(r => r.fileMaxNestingDepth > 4);

  console.log(`Total: ${deepNestingFiles.length} files with deep nesting (out of ${results.length} total files)\n`);

  if (deepNestingFiles.length > 0) {
    console.log('Top 30 files with deepest nesting:\n');

    deepNestingFiles.slice(0, 30).forEach((result, index) => {
      const relativePath = path.relative(projectRoot, result.filePath);
      console.log(`${index + 1}. ${relativePath}`);
      console.log(`   Max Nesting Depth: ${result.fileMaxNestingDepth} levels`);

      // Show functions with deepest nesting
      const deepFuncs = result.functions
        .filter(f => f.nestingDepth > 4)
        .sort((a, b) => b.nestingDepth - a.nestingDepth)
        .slice(0, 3);

      if (deepFuncs.length > 0) {
        console.log(`   Deepest Functions:`);
        deepFuncs.forEach((func, i) => {
          console.log(`     ${i + 1}. ${func.name}: ${func.nestingDepth} levels (${func.length} lines)`);
        });
      }
      console.log('');
    });
  }

  console.log('\n3. FUNCTION LENGTH ANALYSIS');
  console.log('═'.repeat(100));
  console.log('Files containing functions longer than 100 lines\n');

  const longFunctionFiles = sortByFunctionLength.filter(r => r.longestFunction.length > 100);

  console.log(`Total: ${longFunctionFiles.length} files with functions > 100 lines\n`);

  if (longFunctionFiles.length > 0) {
    longFunctionFiles.forEach((result, index) => {
      const relativePath = path.relative(projectRoot, result.filePath);
      console.log(`${index + 1}. ${relativePath}`);
      console.log(`   Longest Function: ${result.longestFunction.name} (${result.longestFunction.length} lines)`);

      // Show all functions > 50 lines
      const longFuncs = result.functions
        .filter(f => f.length > 50)
        .sort((a, b) => b.length - a.length);

      if (longFuncs.length > 1) {
        console.log(`   Other Long Functions (>50 lines):`);
        longFuncs.slice(1).forEach((func, i) => {
          console.log(`     ${i + 1}. ${func.name}: ${func.length} lines (complexity: ${func.complexity})`);
        });
      }
      console.log('');
    });
  } else {
    console.log('No functions longer than 100 lines found.\n');
  }

  console.log('\n4. FUNCTIONS REQUIRING REFACTORING');
  console.log('═'.repeat(100));
  console.log('Functions that exceed multiple thresholds:\n');

  const problematicFunctions = [];
  for (const result of results) {
    for (const func of result.functions) {
      const issues = [];
      if (func.complexity > 20) issues.push(`complexity=${func.complexity}`);
      if (func.length > 50) issues.push(`length=${func.length}`);
      if (func.nestingDepth > 5) issues.push(`nesting=${func.nestingDepth}`);

      if (issues.length >= 2) {
        problematicFunctions.push({
          file: path.relative(projectRoot, result.filePath),
          function: func.name,
          issues: issues.join(', ')
        });
      }
    }
  }

  if (problematicFunctions.length > 0) {
    console.log(`Found ${problematicFunctions.length} functions requiring attention:\n`);
    problematicFunctions.slice(0, 50).forEach((item, index) => {
      console.log(`${index + 1}. ${item.file}`);
      console.log(`   Function: ${item.function}`);
      console.log(`   Issues: ${item.issues}\n`);
    });
  } else {
    console.log('No functions exceed multiple thresholds. Good!\n');
  }

  console.log('\n5. SUMMARY STATISTICS');
  console.log('═'.repeat(100));

  const totalComplexity = results.reduce((sum, r) => sum + r.fileComplexity, 0);
  const avgComplexity = totalComplexity / results.length;
  const maxComplexity = Math.max(...results.map(r => r.fileComplexity));
  const maxNesting = Math.max(...results.map(r => r.fileMaxNestingDepth));
  const maxFuncLength = Math.max(...results.map(r => r.longestFunction.length));

  // Count files by complexity ranges
  const complexityRanges = {
    simple: results.filter(r => r.fileComplexity <= 10).length,
    moderate: results.filter(r => r.fileComplexity > 10 && r.fileComplexity <= 20).length,
    complex: results.filter(r => r.fileComplexity > 20 && r.fileComplexity <= 50).length,
    veryComplex: results.filter(r => r.fileComplexity > 50).length
  };

  console.log(`Total Files Analyzed: ${results.length}`);
  console.log(`Total Complexity Score: ${totalComplexity}`);
  console.log(`Average Complexity per File: ${avgComplexity.toFixed(2)}`);
  console.log(`Highest Complexity Score: ${maxComplexity}`);
  console.log(`Highest Nesting Depth: ${maxNesting} levels`);
  console.log(`Longest Function: ${maxFuncLength} lines`);
  console.log(`Files with Deep Nesting (>4): ${deepNestingFiles.length} (${((deepNestingFiles.length/results.length)*100).toFixed(1)}%)`);
  console.log(`Files with Long Functions (>100): ${longFunctionFiles.length} (${((longFunctionFiles.length/results.length)*100).toFixed(1)}%)`);

  console.log('\nComplexity Distribution:');
  console.log(`  Simple (1-10): ${complexityRanges.simple} files (${((complexityRanges.simple/results.length)*100).toFixed(1)}%)`);
  console.log(`  Moderate (11-20): ${complexityRanges.moderate} files (${((complexityRanges.moderate/results.length)*100).toFixed(1)}%)`);
  console.log(`  Complex (21-50): ${complexityRanges.complex} files (${((complexityRanges.complex/results.length)*100).toFixed(1)}%)`);
  console.log(`  Very Complex (>50): ${complexityRanges.veryComplex} files (${((complexityRanges.veryComplex/results.length)*100).toFixed(1)}%)`);

  console.log('\n' + '═'.repeat(100));
  console.log('Analysis Complete');
  console.log('═'.repeat(100));

  // Return data for potential programmatic use
  return {
    results,
    sortByComplexity: sortByComplexity.slice(0, 20),
    deepNestingFiles,
    longFunctionFiles,
    problematicFunctions
  };
}

// Run the analysis
analyzeProject();
