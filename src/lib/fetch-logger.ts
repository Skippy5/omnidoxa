/**
 * OmniDoxa Fetch & Analysis Logger
 * Tracks news fetching and sentiment analysis with detailed timestamps
 */

import fs from 'fs';
import path from 'path';

const IS_SERVERLESS = !!process.env.VERCEL;
const LOGS_DIR = IS_SERVERLESS ? '' : path.join(process.cwd(), 'logs');

// Ensure logs directory exists (local dev only)
if (!IS_SERVERLESS && !fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export interface CategoryLog {
  category: string;
  fetchStart: string;
  fetchEnd?: string;
  articleCount: number;
  analysisStart?: string;
  analysisEnd?: string;
  articlesAnalyzed: number;
  errors: string[];
  duration?: number; // milliseconds
}

export class FetchLogger {
  private date: string;
  private categoryLogs: Map<string, CategoryLog> = new Map();
  private overallStart: string;
  
  constructor() {
    const now = new Date();
    this.date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    this.overallStart = now.toISOString();
  }
  
  /**
   * Log category fetch started
   */
  logFetchStart(category: string): void {
    const timestamp = new Date().toISOString();
    this.categoryLogs.set(category, {
      category,
      fetchStart: timestamp,
      articleCount: 0,
      articlesAnalyzed: 0,
      errors: []
    });
    
    this.appendToCategoryLog(category, 
      `[${this.formatTime(timestamp)}] 📰 FETCH STARTED: ${category.toUpperCase()}`
    );
  }
  
  /**
   * Log category fetch completed
   */
  logFetchComplete(category: string, count: number): void {
    const timestamp = new Date().toISOString();
    const log = this.categoryLogs.get(category);
    if (log) {
      log.fetchEnd = timestamp;
      log.articleCount = count;
      
      const fetchDuration = new Date(timestamp).getTime() - new Date(log.fetchStart).getTime();
      
      this.appendToCategoryLog(category, 
        `[${this.formatTime(timestamp)}] ✅ FETCH COMPLETE: ${count} articles downloaded (${(fetchDuration / 1000).toFixed(1)}s)`
      );
    }
  }
  
  /**
   * Log sentiment analysis started
   */
  logAnalysisStart(category: string): void {
    const timestamp = new Date().toISOString();
    const log = this.categoryLogs.get(category);
    if (log) {
      log.analysisStart = timestamp;
      
      this.appendToCategoryLog(category, 
        `[${this.formatTime(timestamp)}] 📊 SENTIMENT ANALYSIS STARTED`
      );
    }
  }
  
  /**
   * Log individual article analyzed
   */
  logArticleAnalyzed(category: string, index: number, title: string, tweetCount: number): void {
    const timestamp = new Date().toISOString();
    const log = this.categoryLogs.get(category);
    if (log) {
      log.articlesAnalyzed++;
      
      this.appendToCategoryLog(category, 
        `[${this.formatTime(timestamp)}]   └─ Article ${index}/${log.articleCount}: "${title.substring(0, 60)}..." (${tweetCount} tweets)`
      );
    }
  }
  
  /**
   * Log sentiment analysis completed
   */
  logAnalysisComplete(category: string): void {
    const timestamp = new Date().toISOString();
    const log = this.categoryLogs.get(category);
    if (log) {
      log.analysisEnd = timestamp;
      
      const analysisDuration = new Date(timestamp).getTime() - new Date(log.analysisStart!).getTime();
      const totalDuration = new Date(timestamp).getTime() - new Date(log.fetchStart).getTime();
      log.duration = totalDuration;
      
      this.appendToCategoryLog(category, 
        `[${this.formatTime(timestamp)}] ✅ SENTIMENT ANALYSIS COMPLETE: ${log.articlesAnalyzed} articles analyzed (${(analysisDuration / 1000).toFixed(1)}s)`
      );
      
      this.appendToCategoryLog(category, 
        `[${this.formatTime(timestamp)}] 🏁 CATEGORY COMPLETE: Total time ${(totalDuration / 1000).toFixed(1)}s\n`
      );
    }
  }
  
  /**
   * Log error
   */
  logError(category: string, error: string): void {
    const timestamp = new Date().toISOString();
    const log = this.categoryLogs.get(category);
    if (log) {
      log.errors.push(error);
      
      this.appendToCategoryLog(category, 
        `[${this.formatTime(timestamp)}] ❌ ERROR: ${error}`
      );
    }
  }
  
  /**
   * Generate daily summary log
   */
  generateDailySummary(): void {
    const timestamp = new Date().toISOString();
    const overallEnd = timestamp;
    const totalDuration = new Date(overallEnd).getTime() - new Date(this.overallStart).getTime();
    
    let summary = '';
    summary += `═══════════════════════════════════════════════════════════════════\n`;
    summary += `  OmniDoxa Daily News Fetch Summary - ${this.date}\n`;
    summary += `═══════════════════════════════════════════════════════════════════\n\n`;

    summary += `Overall Duration: ${this.formatTime(this.overallStart)} → ${this.formatTime(overallEnd)} (${(totalDuration / 60000).toFixed(1)} minutes)\n\n`;

    summary += `Category Results:\n`;
    summary += `─────────────────────────────────────────────────────────────────\n`;

    let totalArticles = 0;
    let totalAnalyzed = 0;
    let totalErrors = 0;

    Array.from(this.categoryLogs.values()).forEach(log => {
      totalArticles += log.articleCount;
      totalAnalyzed += log.articlesAnalyzed;
      totalErrors += log.errors.length;

      summary += `\n📰 ${log.category.toUpperCase()}\n`;
      summary += `   Fetch:    ${this.formatTime(log.fetchStart)} → ${this.formatTime(log.fetchEnd || '')} (${log.articleCount} articles)\n`;
      summary += `   Analysis: ${this.formatTime(log.analysisStart || '')} → ${this.formatTime(log.analysisEnd || '')} (${log.articlesAnalyzed} analyzed)\n`;
      summary += `   Duration: ${((log.duration || 0) / 1000).toFixed(1)}s\n`;
      if (log.errors.length > 0) {
        summary += `   Errors:   ${log.errors.length}\n`;
        log.errors.forEach(err => summary += `      - ${err}\n`);
      }
    });

    summary += `\n─────────────────────────────────────────────────────────────────\n`;
    summary += `TOTALS:\n`;
    summary += `  Categories:  ${this.categoryLogs.size}\n`;
    summary += `  Fetched:     ${totalArticles} articles\n`;
    summary += `  Analyzed:    ${totalAnalyzed} articles\n`;
    summary += `  Errors:      ${totalErrors}\n`;
    summary += `  Success:     ${totalArticles > 0 ? ((totalAnalyzed / totalArticles) * 100).toFixed(1) : '0.0'}%\n`;
    summary += `═══════════════════════════════════════════════════════════════════\n`;

    if (IS_SERVERLESS) {
      console.log(summary);
    } else {
      const summaryPath = path.join(LOGS_DIR, `${this.date}-summary.log`);
      fs.writeFileSync(summaryPath, summary);
      console.log(`\n📝 Daily summary saved: ${summaryPath}`);
    }
  }
  
  /**
   * Append log entry to category-specific log file
   */
  private appendToCategoryLog(category: string, message: string): void {
    if (IS_SERVERLESS) {
      console.log(message);
      return;
    }

    const logPath = path.join(LOGS_DIR, `${this.date}-${category}.log`);
    const entry = message + '\n';

    try {
      fs.appendFileSync(logPath, entry);
    } catch (error) {
      console.error(`Failed to write to log file ${logPath}:`, error);
    }
  }
  
  /**
   * Format timestamp for display
   */
  private formatTime(iso: string): string {
    if (!iso) return 'N/A';
    const date = new Date(iso);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  }
}
