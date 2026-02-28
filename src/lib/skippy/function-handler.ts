/**
 * OmniDoxa Function Handler for Skippy
 * 
 * Purpose: Handle Claude function calls for conversational OmniDoxa pipeline control
 * Created: 2026-02-28
 * Status: Active
 */

const OMNIDOXA_API_URL = process.env.OMNIDOXA_API_URL || 'http://localhost:3001';

/**
 * Function call response format
 */
export interface FunctionResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Pipeline run request body
 */
interface PipelineRunRequest {
  operation: 'category_refresh' | 'keyword_search' | 'full_refresh' | 'reanalyze_category';
  params: {
    categories?: string[];
    articlesPerCategory?: number;
    keywords?: string;
    maxArticles?: number;
    category?: string;
    analysisTypes?: string[];
  };
  trigger_source: 'conversational';
  trigger_context: {
    user_request: string;
    function_call: string;
    function_params: any;
  };
}

/**
 * Handle refresh_categories function call
 */
export async function handleRefreshCategories(
  params: { categories: string[]; articlesPerCategory?: number },
  userRequest: string
): Promise<FunctionResponse> {
  try {
    const { categories, articlesPerCategory = 5 } = params;

    // Validate categories
    const validCategories = [
      'breaking', 'business', 'crime', 'entertainment', 'politics',
      'science', 'top', 'world', 'technology', 'domestic'
    ];

    const invalid = categories.filter(c => !validCategories.includes(c));
    if (invalid.length > 0) {
      return {
        success: false,
        message: `❌ Invalid categories: ${invalid.join(', ')}`,
        error: `Unknown categories: ${invalid.join(', ')}`
      };
    }

    // Build API request
    const requestBody: PipelineRunRequest = {
      operation: 'category_refresh',
      params: {
        categories,
        articlesPerCategory
      },
      trigger_source: 'conversational',
      trigger_context: {
        user_request: userRequest,
        function_call: 'omnidoxa_refresh_categories',
        function_params: params
      }
    };

    // Call OmniDoxa API
    const response = await fetch(`${OMNIDOXA_API_URL}/api/pipeline/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `❌ Failed to refresh ${categories.join(', ')}: ${response.statusText}`,
        error: errorText
      };
    }

    const data = await response.json();
    const runId = data.runId;

    // User-friendly message
    const categoriesStr = categories.length === 1
      ? categories[0]
      : categories.slice(0, -1).join(', ') + ' and ' + categories[categories.length - 1];

    return {
      success: true,
      message: `✅ Fetching fresh ${categoriesStr} articles now. Run ID: ${runId}. Should take ~${categories.length * 60}s.`,
      data
    };

  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to trigger pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: String(error)
    };
  }
}

/**
 * Handle search_news function call
 */
export async function handleSearchNews(
  params: { keywords: string; maxArticles?: number },
  userRequest: string
): Promise<FunctionResponse> {
  try {
    const { keywords, maxArticles = 10 } = params;

    const requestBody: PipelineRunRequest = {
      operation: 'keyword_search',
      params: {
        keywords,
        maxArticles
      },
      trigger_source: 'conversational',
      trigger_context: {
        user_request: userRequest,
        function_call: 'omnidoxa_search_news',
        function_params: params
      }
    };

    const response = await fetch(`${OMNIDOXA_API_URL}/api/pipeline/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `❌ Failed to search for "${keywords}": ${response.statusText}`,
        error: errorText
      };
    }

    const data = await response.json();
    const runId = data.runId;

    return {
      success: true,
      message: `🔍 Searching for news about "${keywords}"... Run ID: ${runId}. I'll let you know what I find!`,
      data
    };

  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to trigger search: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: String(error)
    };
  }
}

/**
 * Handle reanalyze_category function call
 */
export async function handleReanalyzeCategory(
  params: { category: string; analysisTypes?: string[] },
  userRequest: string
): Promise<FunctionResponse> {
  try {
    const { category, analysisTypes = ['twitter'] } = params;

    // Validate category
    const validCategories = [
      'breaking', 'business', 'crime', 'entertainment', 'politics',
      'science', 'top', 'world', 'technology', 'domestic'
    ];

    if (!validCategories.includes(category)) {
      return {
        success: false,
        message: `❌ Invalid category: ${category}`,
        error: `Unknown category: ${category}`
      };
    }

    // Validate analysis types
    const validTypes = ['twitter', 'reddit', 'ai_sentiment'];
    const invalid = analysisTypes.filter(t => !validTypes.includes(t));
    if (invalid.length > 0) {
      return {
        success: false,
        message: `❌ Invalid analysis types: ${invalid.join(', ')}`,
        error: `Unknown analysis types: ${invalid.join(', ')}`
      };
    }

    const requestBody: PipelineRunRequest = {
      operation: 'reanalyze_category',
      params: {
        category,
        analysisTypes
      },
      trigger_source: 'conversational',
      trigger_context: {
        user_request: userRequest,
        function_call: 'omnidoxa_reanalyze_category',
        function_params: params
      }
    };

    const response = await fetch(`${OMNIDOXA_API_URL}/api/pipeline/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `❌ Failed to re-analyze ${category}: ${response.statusText}`,
        error: errorText
      };
    }

    const data = await response.json();
    const articleCount = data.articleCount || '?';

    const analysisStr = analysisTypes.length === 1
      ? analysisTypes[0].replace('_', ' ')
      : analysisTypes.join(', ').replace(/_/g, ' ');

    return {
      success: true,
      message: `🔄 Re-running ${analysisStr} analysis on ${category} articles. ${articleCount} articles will be updated.`,
      data
    };

  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to trigger re-analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: String(error)
    };
  }
}

/**
 * Handle get_status function call
 */
export async function handleGetStatus(
  params: { runId?: number }
): Promise<FunctionResponse> {
  try {
    let { runId } = params;

    // If no runId provided, get latest run from database
    if (!runId) {
      try {
        // Query database directly for latest run
        const { turso } = await import('/home/skippy/Projects/omnidoxa/src/lib/db-turso');
        const result = await turso.execute({
          sql: 'SELECT id FROM pipeline_runs ORDER BY started_at DESC LIMIT 1',
          args: []
        });
        
        if (result.rows.length === 0) {
          return {
            success: false,
            message: '❌ No pipeline runs found',
            error: 'No runs in database'
          };
        }
        
        runId = Number(result.rows[0].id);
      } catch (dbError) {
        return {
          success: false,
          message: '❌ Failed to fetch latest run',
          error: `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown'}`
        };
      }
    }

    const url = `${OMNIDOXA_API_URL}/api/pipeline/status?runId=${runId}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `❌ Failed to get status: ${response.statusText}`,
        error: errorText
      };
    }

    const data = await response.json();

    // Format status message
    const { runId: id, status, stage, progress } = data;

    let statusEmoji = '⏳';
    if (status === 'complete') statusEmoji = '✅';
    if (status === 'failed') statusEmoji = '❌';
    if (status === 'running' || status === 'analyzing') statusEmoji = '🔄';

    let message = `${statusEmoji} Run #${id}: ${status}`;
    if (stage) message += `\nStage: ${stage}`;
    if (progress !== undefined) message += `\nProgress: ${progress}%`;

    return {
      success: true,
      message,
      data
    };

  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: String(error)
    };
  }
}

/**
 * Main entry point for handling OmniDoxa function calls
 */
export async function handleOmniDoxaFunction(
  functionName: string,
  params: any,
  userRequest: string
): Promise<FunctionResponse> {
  switch (functionName) {
    case 'omnidoxa_refresh_categories':
      return handleRefreshCategories(params, userRequest);

    case 'omnidoxa_search_news':
      return handleSearchNews(params, userRequest);

    case 'omnidoxa_reanalyze_category':
      return handleReanalyzeCategory(params, userRequest);

    case 'omnidoxa_get_status':
      return handleGetStatus(params);

    default:
      return {
        success: false,
        message: `❌ Unknown function: ${functionName}`,
        error: `Function not found: ${functionName}`
      };
  }
}
