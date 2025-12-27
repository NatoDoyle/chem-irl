#!/usr/bin/env node

/**
 * Markdown Link Integrity Checker
 * 
 * Validates all markdown links in the repository to ensure they resolve correctly.
 * Excludes archive directories and node_modules by default.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { dirname, resolve, normalize, relative } from 'path';

interface BrokenLink {
  file: string;
  line: number;
  link: string;
  target: string;
}

const REPO_ROOT = process.cwd();
const ARCHIVE_PATTERNS = ['**/archive/**', '**/node_modules/**', '**/.expo/**', '**/out/**'];

/**
 * Check if a path should be excluded from checking
 */
function shouldExclude(filePath: string): boolean {
  const relativePath = relative(REPO_ROOT, filePath);
  return ARCHIVE_PATTERNS.some((pattern) => {
    const normalizedPattern = pattern.replace(/\*\*/g, '.*');
    const regex = new RegExp(normalizedPattern.replace(/\//g, '[/\\\\]'));
    return regex.test(relativePath);
  });
}

/**
 * Extract all markdown links from a file
 */
function extractLinks(content: string, filePath: string): Array<{ link: string; target: string; line: number }> {
  const links: Array<{ link: string; target: string; line: number }> = [];
  const lines = content.split('\n');

  // Match markdown links: [text](path.md) or [text](path.md#anchor)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  lines.forEach((line, index) => {
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const fullLink = match[0];
      const target = match[2];

      // Skip external links (http/https/mailto) and anchor-only links
      if (target.match(/^(https?|mailto):/)) {
        continue;
      }
      
      // Skip anchor-only links (starting with #)
      if (target.startsWith('#')) {
        continue;
      }
      
      links.push({
        link: fullLink,
        target,
        line: index + 1,
      });
    }
  });

  return links;
}

/**
 * Resolve a relative link path relative to the source file
 */
function resolveLinkPath(sourceFile: string, linkTarget: string): string {
  // Remove anchor if present
  const [pathPart] = linkTarget.split('#');
  
  // Resolve relative to source file's directory
  const sourceDir = dirname(sourceFile);
  const resolved = resolve(sourceDir, pathPart);
  
  // Normalize path separators
  return normalize(resolved);
}

/**
 * Check if a file or directory exists (handles .md extension automatically)
 */
function checkFileExists(targetPath: string): boolean {
  // Check if path exists (file or directory)
  if (existsSync(targetPath)) {
    return true;
  }

  // Try with .md extension if not already present (for files only)
  if (!targetPath.endsWith('.md') && !targetPath.endsWith('/')) {
    const withMd = `${targetPath}.md`;
    if (existsSync(withMd)) {
      return true;
    }
  }

  return false;
}

/**
 * Recursively find all markdown files
 */
function findMarkdownFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = resolve(dir, file.name);
    const relativePath = relative(REPO_ROOT, fullPath);

    // Skip excluded patterns
    if (shouldExclude(fullPath)) {
      continue;
    }

    // Skip hidden directories (except .github)
    if (file.isDirectory() && file.name.startsWith('.') && file.name !== '.github') {
      continue;
    }
    
    // Skip node_modules
    if (file.isDirectory() && file.name === 'node_modules') {
      continue;
    }

    if (file.isDirectory()) {
      findMarkdownFiles(fullPath, fileList);
    } else if (file.isFile() && file.name.endsWith('.md')) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

/**
 * Main function to check all markdown files
 */
function checkMarkdownLinks(): { broken: BrokenLink[]; totalFiles: number; totalLinks: number } {
  const brokenLinks: BrokenLink[] = [];
  let totalFiles = 0;
  let totalLinks = 0;

  // Find all markdown files
  const markdownFiles = findMarkdownFiles(REPO_ROOT);

  for (const filePath of markdownFiles) {
    if (shouldExclude(filePath)) {
      continue;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const links = extractLinks(content, filePath);
      totalFiles++;
      totalLinks += links.length;

      for (const { link, target, line } of links) {
        const resolvedPath = resolveLinkPath(filePath, target);

        // Check if target file exists
        if (!checkFileExists(resolvedPath)) {
          const relativePath = relative(REPO_ROOT, filePath);
          brokenLinks.push({
            file: relativePath,
            line,
            link,
            target,
          });
        }
      }
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
    }
  }

  return { broken: brokenLinks, totalFiles, totalLinks };
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Checking markdown links...\n');

  const { broken, totalFiles, totalLinks } = checkMarkdownLinks();

  if (broken.length === 0) {
    console.log(`✅ All links valid!`);
    console.log(`   Checked ${totalFiles} files with ${totalLinks} links\n`);
    process.exit(0);
  } else {
    console.error(`❌ Found ${broken.length} broken link(s):\n`);
    
    for (const { file, line, link, target } of broken) {
      console.error(`  ${file}:${line}`);
      console.error(`    Link: ${link}`);
      console.error(`    Target: ${target}\n`);
    }

    console.error(`Checked ${totalFiles} files with ${totalLinks} links\n`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}

