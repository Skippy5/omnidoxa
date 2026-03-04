/**
 * Manual Promotion - Run 46
 * 
 * Manually promotes the 39 analyzed articles from staging to live database
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local'), override: true });

import { promoteToLive } from './src/lib/pipeline/promotion';
import { turso } from './src/lib/db-turso';

async function manualPromote() {
  const runId = 46;
  
  console.log('🚀 MANUAL PROMOTION - RUN 46\n');
  console.log('This will promote analyzed articles from staging to live database\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Get categories for this run
    const config = await turso.execute({
      sql: 'SELECT config FROM pipeline_runs WHERE id = ?',
      args: [runId]
    });
    
    const runConfig = JSON.parse(config.rows[0]?.config as string || '{}');
    const categories = runConfig.categories || [];
    
    console.log(`Categories: ${categories.join(', ')}\n`);
    
    // Run promotion
    const result = await promoteToLive(runId, categories);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PROMOTION COMPLETE\n');
    console.log('Results:');
    console.log(`  Stories promoted: ${result.storiesPromoted}`);
    console.log(`  Viewpoints promoted: ${result.viewpointsPromoted}`);
    console.log(`  Social posts promoted: ${result.socialPostsPromoted}`);
    console.log(`  Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    // Update run status to complete
    await turso.execute({
      sql: `UPDATE pipeline_runs 
            SET status = 'complete', 
                current_stage = 'promotion', 
                completed_at = datetime('now')
            WHERE id = ?`,
      args: [runId]
    });
    
    console.log('\n✅ Run 46 marked as complete');
    console.log('\n🎉 Check OmniDoxa.com to see fresh articles live!');
    
  } catch (error) {
    console.error('\n❌ Promotion failed:', error);
    process.exit(1);
  }
}

manualPromote();
