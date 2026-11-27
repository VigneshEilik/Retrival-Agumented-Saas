import { withTenantContext } from '../../db';
import { GroundedCitation } from '../RAG/orchestration/citation.resolver';
import { notFound } from '../../middleware/error_handler';

export interface ConversationRecord {
  id: string;
  title: string;
  knowledge_base_id: string | null;
  user_id: string | null;
}

export class ConversationService {
  static async createConversation(
    organizationId: string,
    userId: string | null,
    knowledgeBaseId?: string,
    title = 'New Conversation'
  ) {
    return withTenantContext(organizationId, async (client) => {
      if (knowledgeBaseId) {
        const kb = await client.query(`SELECT 1 FROM knowledge_bases WHERE id = $1 AND organization_id = $2`, [
          knowledgeBaseId,
          organizationId,
        ]);
        if (kb.rows.length === 0) throw notFound('Knowledge base not found', 'KB_NOT_FOUND');
      }
      const res = await client.query(
        `INSERT INTO conversations (organization_id, user_id, knowledge_base_id, title)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, knowledge_base_id, created_at, updated_at`,
        [organizationId, userId, knowledgeBaseId || null, title]
      );
      return res.rows[0];
    }, userId);
  }

  static async listConversations(organizationId: string, userId: string | null, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `SELECT id, title, knowledge_base_id, created_at, updated_at
         FROM conversations
         WHERE organization_id = $1 AND user_id IS NOT DISTINCT FROM $2
         ORDER BY updated_at DESC
         LIMIT $3 OFFSET $4`,
        [organizationId, userId, limit, offset]
      );
      return res.rows;
    }, userId);
  }

  /**
   * Loads a conversation the caller is allowed to use: same organisation (RLS) AND same
   * principal (a user sees only their own conversations; API keys only key-created ones).
   * Responds 404 rather than 403 so conversation IDs can't be probed.
   */
  static async getAccessibleConversation(
    organizationId: string,
    userId: string | null,
    conversationId: string
  ): Promise<ConversationRecord> {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `SELECT id, title, knowledge_base_id, user_id FROM conversations
          WHERE id = $1 AND organization_id = $2 AND user_id IS NOT DISTINCT FROM $3`,
        [conversationId, organizationId, userId]
      );
      if (res.rows.length === 0) throw notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');
      return res.rows[0];
    });
  }

  /** Most recent turns (oldest first), used to answer follow-up questions in context. */
  static async getRecentHistory(organizationId: string, conversationId: string, maxMessages = 6) {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `SELECT role, content FROM messages
          WHERE conversation_id = $1 AND organization_id = $2 AND role IN ('user', 'assistant')
          ORDER BY created_at DESC LIMIT $3`,
        [conversationId, organizationId, maxMessages]
      );
      return res.rows.reverse() as Array<{ role: 'user' | 'assistant'; content: string }>;
    });
  }

  static async getConversationMessages(organizationId: string, conversationId: string, userId: string | null) {
    await this.getAccessibleConversation(organizationId, userId, conversationId);
    return withTenantContext(organizationId, async (client) => {
      const convRes = await client.query(
        `SELECT id, title, knowledge_base_id FROM conversations WHERE id = $1 AND organization_id = $2`,
        [conversationId, organizationId]
      );

      const msgRes = await client.query(
        `SELECT m.id, m.role, m.content, m.prompt_tokens, m.completion_tokens, m.latency_ms, m.created_at
         FROM messages m
         WHERE m.conversation_id = $1 AND m.organization_id = $2
         ORDER BY m.created_at ASC`,
        [conversationId, organizationId]
      );

      const messageIds = msgRes.rows.map((m) => m.id);
      let sourcesMap = new Map<string, GroundedCitation[]>();

      if (messageIds.length > 0) {
        const srcRes = await client.query(
          `SELECT ms.message_id, ms.document_id, ms.document_chunk_id, ms.relevance_score, ms.snippet, ms.metadata,
                  d.title as document_title
           FROM message_sources ms
           LEFT JOIN documents d ON d.id = ms.document_id
           WHERE ms.message_id = ANY($1::uuid[]) AND ms.organization_id = $2`,
          [messageIds, organizationId]
        );

        srcRes.rows.forEach((row, idx) => {
          const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {};
          const citation: GroundedCitation = {
            // The number used in the answer text ([1], [2]...) is stored with the source.
            citationId: typeof meta.citationId === 'number' ? meta.citationId : idx + 1,
            documentId: row.document_id,
            documentTitle: row.document_title || 'Document',
            chunkId: row.document_chunk_id,
            pageNumber: meta.pageNumber,
            sectionTitle: meta.sectionTitle,
            snippet: row.snippet,
            relevanceScore: parseFloat(row.relevance_score) || 0,
          };

          if (!sourcesMap.has(row.message_id)) {
            sourcesMap.set(row.message_id, []);
          }
          sourcesMap.get(row.message_id)!.push(citation);
        });
      }

      const messagesWithSources = msgRes.rows.map((msg) => ({
        ...msg,
        sources: sourcesMap.get(msg.id) || [],
      }));

      return {
        conversation: convRes.rows[0],
        messages: messagesWithSources,
      };
    });
  }

  static async saveMessage(
    organizationId: string,
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    citations?: GroundedCitation[],
    promptTokens = 0,
    completionTokens = 0,
    latencyMs = 0
  ) {
    return withTenantContext(organizationId, async (client) => {
      const msgRes = await client.query(
        `INSERT INTO messages (conversation_id, organization_id, role, content, prompt_tokens, completion_tokens, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, role, content, created_at`,
        [conversationId, organizationId, role, content, promptTokens, completionTokens, latencyMs]
      );
      const message = msgRes.rows[0];

      if (citations && citations.length > 0) {
        for (const cit of citations) {
          await client.query(
            `INSERT INTO message_sources (message_id, organization_id, document_id, document_chunk_id, relevance_score, snippet, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              message.id,
              organizationId,
              cit.documentId,
              cit.chunkId,
              cit.relevanceScore,
              cit.snippet,
              JSON.stringify({ pageNumber: cit.pageNumber, sectionTitle: cit.sectionTitle, citationId: cit.citationId }),
            ]
          );
        }
      }

      await client.query(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [conversationId]);

      return message;
    });
  }
}
