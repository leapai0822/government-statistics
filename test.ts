import { createClient } from ‘npm:@supabase/supabase-js@2.58.0’;

const corsHeaders = {
  ‘Access-Control-Allow-Origin’: ‘*’,
  ‘Access-Control-Allow-Methods’: ‘GET, POST, PUT, DELETE, OPTIONS’,
  ‘Access-Control-Allow-Headers’: ‘Content-Type, Authorization, X-Client-Info, Apikey’,
};

interface UserProfile {
  displayName: string;
  bio: string;
  learningGoal: string;
  userLevel: ‘beginner’ | ‘intermediate’ | ‘advanced’;
}

interface ChatRequest {
  threadId: string;
  message: string;
  languagePreference?: ‘bilingual’ | ‘korean_only’;
  userProfile?: UserProfile;
}

Deno.serve(async (req: Request) => {
  if (req.method === ‘OPTIONS’) {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get(‘SUPABASE_URL’)!;
    const supabaseServiceKey = Deno.env.get(‘SUPABASE_SERVICE_ROLE_KEY’)!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get(‘Authorization’);
    if (!authHeader) {
      throw new Error(‘Missing authorization header’);
    }

    const token = authHeader.replace(‘Bearer ‘, ‘’);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error(‘Invalid token’);
    }

    const { threadId, message, languagePreference, userProfile }: ChatRequest = await req.json();

    if (!threadId || !message) {
      throw new Error(‘threadId and message are required’);
    }

    // チャット送信制限をチェック
    const { data: usageCheck, error: usageCheckError } = await supabase
      .rpc(‘check_chat_usage_limit’, { p_user_id: user.id })
      .single();

    if (usageCheckError) {
      console.error(‘Usage check error:’, usageCheckError);
      throw new Error(‘Failed to check usage limit’);
    }

    if (!usageCheck || !usageCheck.can_send) {
      return new Response(
        JSON.stringify({
          error: ‘daily_limit_reached’,
          message: `1日の送信制限に達しました。本日の送信回数: ${usageCheck?.current_count || 0}/${usageCheck?.daily_limit || 0}`,
          current_count: usageCheck?.current_count || 0,
          daily_limit: usageCheck?.daily_limit || 0,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            ‘Content-Type’: ‘application/json’,
          },
        }
      );
    }

    const effectiveLanguagePreference = languagePreference || ‘bilingual’;

    const { data: thread, error: threadError } = await supabase
      .from(‘chat_threads’)
      .select(‘user_id’)
      .eq(‘id’, threadId)
      .single();

    if (threadError || !thread) {
      throw new Error(‘Thread not found’);
    }

    if (thread.user_id !== user.id) {
      throw new Error(‘Unauthorized access to thread’);
    }

    const { error: userMessageError } = await supabase
      .from(‘chat_messages’)
      .insert({
        thread_id: threadId,
        role: ‘user’,
        content: message,
      });

    if (userMessageError) {
      throw userMessageError;
    }

    const { data: recentMessages, error: messagesError } = await supabase
      .from(‘chat_messages’)
      .select(‘role, content’)
      .eq(‘thread_id’, threadId)
      .order(‘created_at’, { ascending: false })
      .limit(10);

    if (messagesError) {
      throw messagesError;
    }

    const conversationHistory = (recentMessages || []).reverse();

    const openaiApiKey = Deno.env.get(‘OPENAI_API_KEY’);
    let assistantReply: string;

    const levelMap = {
      beginner: ‘初級‘,
      intermediate: ‘中級‘,
      advanced: ‘上級‘,
    };

    const levelMapKorean = {
      beginner: ‘초급‘,
      intermediate: ‘중급‘,
      advanced: ‘상급‘,
    };

    const userLevelText = userProfile?.userLevel ? levelMap[userProfile.userLevel] : ‘初級‘;
    const userLevelTextKorean = userProfile?.userLevel ? levelMapKorean[userProfile.userLevel] : ‘초급‘;

    let userContext = ‘’;
    let userContextKorean = ‘’;

    if (userProfile) {
      const contextParts = [];
      const contextPartsKorean = [];

      if (userProfile.displayName) {
        contextParts.push(`ユーザー名: ${userProfile.displayName}`);
        contextPartsKorean.push(`사용자 이름: ${userProfile.displayName}`);
      }
      if (userProfile.bio) {
        contextParts.push(`自己紹介: ${userProfile.bio}`);
        contextPartsKorean.push(`자기소개: ${userProfile.bio}`);
      }
      if (userProfile.learningGoal) {
        contextParts.push(`学習目標: ${userProfile.learningGoal}`);
        contextPartsKorean.push(`학습 목표: ${userProfile.learningGoal}`);
      }
      if (userProfile.userLevel) {
        contextParts.push(`現在のレベル: ${userLevelText}`);
        contextPartsKorean.push(`현재 레벨: ${userLevelTextKorean}`);
      }

      if (contextParts.length > 0) {
        userContext = ‘\n\n【ユーザー情報】\n’ + contextParts.join(‘\n’) + ‘\n\nこの情報を踏まえて、ユーザーのレベルや目標に合わせた返答をしてください。‘;
        userContextKorean = ‘\n\n【사용자 정보】\n’ + contextPartsKorean.join(‘\n’) + ‘\n\n이 정보를 바탕으로 사용자의 레벨과 목표에 맞는 답변을 해주세요.‘;
      }
    }

    const systemPrompts = {
      bilingual: `# 役割
あなたは、ユーザーの韓国語学習を楽しく、かつ効果的にサポートする、フレンドリーな言語学習パートナーです。
単なるアシスタントではなく、会話を楽しみながら自然な韓国語が身につくよう、共感的かつ丁寧な対話をリードしてください。

# 基本原則
- すべての返信は、必ず**韓国語**と**その自然な日本語訳**をセットで提示します。
- 常に正確で、現代の韓国で実際に使われている自然な表現を使用してください。
- ユーザーの誤りは、優しく訂正し、学習意欲を削がないように配慮します。

# 会話の進め方
- ユーザーからの日常的な質問や何気ない会話には、積極的に応答し、関連する単語や表現、文化的な背景などを交えながら話を広げてください。
  - 例：「今日の天気いいですね」というユーザーの発言に対し、「정말 날씨가 좋네요! 이런 날은 ‘화창하다‘고 해요.（本当に天気がいいですね！こういう日は「華やかだ（晴れやかだ）」と言います。）こんな天気の良い日は何をしたいですか？」のように、関連表現を教えたり、質問を投げかけたりして対話を続けます。
- ユーザーが興味を示したトピックについて、さらに深掘りするような質問を投げかけ、会話を活性化させてください。

# 主要機能
- **単語テスト**:
  - テストをリクエストされた場合、必ず「初級」「中級」「上級」からレベルを選択してもらい、難易度を調整します。
  - 連続してテストを行う際は、単語が重複しないように出題します。
  - 正誤判断は、名詞だけでなく動詞、形容詞など品詞を問わず正確に行います。
- **翻訳**:
  - 翻訳をリクエストされた場合、「日本語→韓国語」か「韓国語→日本語」か、翻訳の方向性を必ずユーザーに確認します。

# 制約事項
- 返信が長文になる場合は、最も重要なポイントを要約し、最大1000文字程度にまとめてください。${userContext}`,
      korean_only: `# 역할
당신은 사용자의 한국어 학습을 즐겁고 효과적으로 돕는 친근한 언어 학습 파트너입니다.
단순한 조수를 넘어, 대화를 즐기면서 자연스러운 한국어를 익힐 수 있도록, 공감적이고 다정한 태도로 대화를 이끌어 주세요.

# 기본 원칙
- 모든 답변은 **한국어로만** 제공합니다.
- 항상 학습자가 이해하기 쉽도록, 명확하고 현대 한국에서 실제로 사용되는 자연스러운 표현을 사용해 주세요.
- 사용자의 실수는 부드럽게 교정하며 학습 의욕을 잃지 않도록 배려합니다.

# 대화 방식
- 사용자의 일상적인 질문이나 가벼운 대화에는 적극적으로 응답하고, 관련 단어나 표현, 문화적 배경 등을 섞어가며 대화를 확장해 주세요.
  - 예: 사용자가 “오늘 날씨 좋네요“라고 말하면, “정말 날씨가 좋네요! 이런 날은 ‘화창하다‘고 해요. 이렇게 화창한 날에는 무엇을 하고 싶으세요?” 와 같이 관련 표현을 알려주거나 질문을 던져 대화를 이어갑니다.
- 사용자가 흥미를 보인 주제에 대해 더 깊이 파고드는 질문을 던져 대화를 활성화해 주세요.

# 주요 기능
- **단어 테스트**:
  - 테스트를 요청받으면, 반드시 ‘초급‘, ‘중급‘, ‘상급’ 중에서 레벨을 선택하게 하여 난이도를 조절합니다.
  - 연속으로 테스트를 진행할 경우, 단어가 중복되지 않도록 출제합니다.
  - 정답 여부는 명사뿐만 아니라 동사, 형용사 등 품사에 관계없이 정확하게 판단합니다.
- **번역**:
  - 번역을 요청받으면, ‘일본어→한국어‘인지 ‘한국어→일본어’인지 번역 방향을 반드시 사용자에게 확인합니다.

# 제약 사항
- 답변이 길어질 경우, 가장 중요한 핵심을 요약하여 최대 1000자 내외로 정리해 주세요.${userContextKorean}`,
    };

    if (openaiApiKey) {
      const openaiResponse = await fetch(‘https://api.openai.com/v1/chat/completions’, {
        method: ‘POST’,
        headers: {
          ‘Content-Type’: ‘application/json’,
          ‘Authorization’: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: ‘gpt-4o-mini’,
          messages: [
            {
              role: ‘system’,
              content: systemPrompts[effectiveLanguagePreference],
            },
            ...conversationHistory.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!openaiResponse.ok) {
        throw new Error(‘OpenAI API request failed’);
      }

      const openaiData = await openaiResponse.json();
      assistantReply = openaiData.choices[0].message.content;
    } else {
      assistantReply = ‘こんにちは！韓国語学習をお手伝いします。質問があればお気軽にどうぞ！（注：OpenAI APIキーが設定されていないため、デモ応答を返しています）’;
    }

    const { error: assistantMessageError } = await supabase
      .from(‘chat_messages’)
      .insert({
        thread_id: threadId,
        role: ‘assistant’,
        content: assistantReply,
      });

    if (assistantMessageError) {
      throw assistantMessageError;
    }

    const { error: updateThreadError } = await supabase
      .from(‘chat_threads’)
      .update({
        last_message_at: new Date().toISOString(),
        message_count: conversationHistory.length + 2,
        updated_at: new Date().toISOString(),
      })
      .eq(‘id’, threadId);

    if (updateThreadError) {
      console.error(‘Failed to update thread:’, updateThreadError);
    }

    // チャット使用回数をインクリメント
    const { data: incrementResult, error: incrementError } = await supabase
      .rpc(‘increment_chat_usage’, { p_user_id: user.id });

    if (incrementError) {
      console.error(‘Failed to increment usage:’, incrementError);
    }

    const { error: logError } = await supabase
      .from(‘request_usage_logs’)
      .insert({
        user_id: user.id,
        request_type: ‘chat’,
        requested_at: new Date().toISOString().split(‘T’)[0],
        request_count: 1,
        model_used: openaiApiKey ? ‘gpt-4o-mini’ : ‘fallback’,
      })
      .select()
      .single();

    if (logError && logError.code !== ‘23505’) {
      console.error(‘Failed to log usage:’, logError);
    }

    // 更新後の使用状況を取得
    const { data: updatedUsage } = await supabase
      .rpc(‘check_chat_usage_limit’, { p_user_id: user.id })
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        message: assistantReply,
        usage: {
          current_count: updatedUsage?.current_count || 0,
          daily_limit: updatedUsage?.daily_limit || 0,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          ‘Content-Type’: ‘application/json’,
        },
      }
    );
  } catch (error) {
    console.error(‘Chat function error:‘, error);
    return new Response(
      JSON.stringify({
        error: error.message || ‘Internal server error’,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          ‘Content-Type’: ‘application/json’,
        },
      }
    );
  }
});