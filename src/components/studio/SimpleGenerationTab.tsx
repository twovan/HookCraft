'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GenerationProgress from '@/components/studio/GenerationProgress';
import SensitivityBlockDialog from '@/components/studio/SensitivityBlockDialog';
import SensitivityConfirmDialog from '@/components/studio/SensitivityConfirmDialog';
import { useSensitivityCheck } from '@/hooks/useSensitivityCheck';

const SIMPLE_PROMPT_EXAMPLES = [
  '新世纪音乐，缓慢空灵，合成器垫音和环境音效，纯音乐，宽广空间感，冥想放松',
  '明亮的流行电子乐，轻快鼓点，温暖女声，适合短视频开场，旋律抓耳',
  '城市夜晚氛围，低保真节拍，柔和钢琴和电吉他，慵懒松弛，适合 vlog',
  '国风流行，古筝和笛子点缀，现代鼓组，情绪递进，适合剧情转场',
  '热血摇滚，强劲鼓点和电吉他 riff，副歌有爆发力，适合运动宣传片',
  '清晨咖啡馆氛围，原声吉他，轻柔贝斯，温暖自然，适合生活方式内容',
  '未来感科技配乐，合成器琶音，稳定节奏，干净高级，适合产品展示',
  '电影感史诗配乐，弦乐铺底，低鼓推进，宏大但不压迫，适合品牌片',
  '复古迪斯科，律动贝斯，明亮铜管和拍手节奏，快乐自信，适合活动预热',
  '梦幻儿童音乐，木琴、钢片琴和轻快打击乐，纯音乐，温柔可爱',
];

function pickPromptExample(currentPrompt: string) {
  if (SIMPLE_PROMPT_EXAMPLES.length === 1) {
    return SIMPLE_PROMPT_EXAMPLES[0];
  }

  let nextPrompt = currentPrompt;
  while (nextPrompt === currentPrompt) {
    nextPrompt = SIMPLE_PROMPT_EXAMPLES[
      Math.floor(Math.random() * SIMPLE_PROMPT_EXAMPLES.length)
    ];
  }
  return nextPrompt;
}

export default function SimpleGenerationTab() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const {
    check: sensitivityCheck,
    status: sensitivityStatus,
    result: sensitivityResult,
    loadingMessage: sensitivityLoadingMessage,
    reset: resetSensitivity,
  } = useSensitivityCheck();
  const isSensitivityLoading = sensitivityStatus === 'loading';

  const submitGeneration = async (generationPrompt: string) => {
    const trimmed = generationPrompt.trim();
    if (!trimmed) {
      setError('请输入生成描述');
      return;
    }

    setIsGenerating(true);
    setIsSubmitted(false);
    setError(null);

    try {
      const res = await fetch('/api/kie/simple-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, instrumental }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setIsSubmitted(false);
        setError(data.error || '生成失败，请稍后重试');
        return;
      }

      if (data.creationUrl) {
        setIsSubmitted(true);
        window.setTimeout(() => {
          router.push(data.creationUrl);
        }, 700);
        return;
      }

      if (data.batchId) {
        setIsSubmitted(true);
        window.setTimeout(() => {
          router.push(`/account/creations?expand=${encodeURIComponent(data.batchId)}`);
        }, 700);
        return;
      }

      setIsSubmitted(true);
      setError('生成已提交，但无法打开结果页，请到创作历史查看');
    } catch {
      setIsSubmitted(false);
      setError('生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('请输入生成描述');
      return;
    }

    setError(null);
    setIsSubmitted(false);
    const checkResult = await sensitivityCheck({ description: trimmed });

    if (checkResult?.resultType === 'block') {
      setShowBlockDialog(true);
      return;
    }

    if (checkResult?.resultType === 'rewrite') {
      if (checkResult.rewrittenPrompt && checkResult.styleTags && checkResult.styleTags.length > 0) {
        setShowConfirmDialog(true);
      } else {
        setError('检测到版权相关内容，请修改描述后重试');
      }
      return;
    }

    await submitGeneration(trimmed);
  };

  const handleUseExample = () => {
    setPrompt(pickPromptExample(prompt));
    setError(null);
    setIsSubmitted(false);
    resetSensitivity();
  };

  const handleSensitivityConfirm = () => {
    setShowConfirmDialog(false);
    const rewrittenPrompt = sensitivityResult?.rewrittenPrompt || prompt;
    resetSensitivity();
    void submitGeneration(rewrittenPrompt);
  };

  const handleSensitivityCancel = () => {
    setShowConfirmDialog(false);
    resetSensitivity();
  };

  const handleBlockClose = () => {
    setShowBlockDialog(false);
    resetSensitivity();
  };

  return (
    <>
      <section
        className="studio-card"
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: 24,
          borderRadius: 14,
          border: '1px solid var(--hc-border)',
          background: 'var(--hc-panel)',
          boxShadow: 'var(--hc-shadow-soft)',
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h2
            style={{
              margin: '0 0 8px',
              color: 'var(--hc-text)',
              fontSize: 22,
              fontWeight: 900,
              fontFamily: 'var(--hc-font)',
            }}
          >
            简单模式
          </h2>
          <p
            style={{
              margin: 0,
              color: 'var(--hc-text-muted)',
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            输入一句创作描述，系统会自动完成风格、歌词与生成配置。
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <label
            htmlFor="simple-generation-prompt"
            style={{
              color: 'var(--hc-text)',
              fontSize: 13,
              fontWeight: 800,
              fontFamily: 'var(--hc-font)',
            }}
          >
            生成描述
          </label>
          <button
            type="button"
            onClick={handleUseExample}
            disabled={isGenerating || isSensitivityLoading || isSubmitted}
            style={{
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 30,
              padding: '0 12px',
              borderRadius: 999,
              border: '1px solid var(--hc-border)',
              background: '#11141b',
              color: 'var(--hc-text)',
              fontSize: 12,
              fontWeight: 800,
              cursor: isGenerating || isSensitivityLoading || isSubmitted ? 'not-allowed' : 'pointer',
              opacity: isGenerating || isSensitivityLoading || isSubmitted ? 0.56 : 1,
              fontFamily: 'var(--hc-font)',
            }}
          >
            换个灵感
          </button>
        </div>
        <textarea
          id="simple-generation-prompt"
          value={prompt}
          maxLength={500}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="例如：一首适合短视频开场的明亮流行歌，旋律轻快，有夏日感"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            minHeight: 150,
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid var(--hc-border)',
            background: '#0b0c10',
            color: 'var(--hc-text)',
            fontSize: 14,
            lineHeight: 1.7,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'var(--hc-font)',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 10,
            color: 'var(--hc-text-muted)',
            fontSize: 12,
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={instrumental}
              onChange={(event) => setInstrumental(event.target.checked)}
              style={{ accentColor: '#ceff35' }}
            />
            纯音乐
          </label>
          <span>{prompt.length}/500</span>
        </div>

        {(isSensitivityLoading || isGenerating || isSubmitted) && (
          <div style={{ marginTop: 18 }}>
            {isSensitivityLoading ? (
              <div style={statusPanelStyle}>
                <div style={spinnerStyle} />
                <div>
                  <strong style={statusTitleStyle}>正在进行内容安全检查</strong>
                  <p style={statusTextStyle}>
                    {sensitivityLoadingMessage || '正在检查描述内容，确认通过后会继续提交生成任务。'}
                  </p>
                </div>
              </div>
            ) : isGenerating ? (
              <GenerationProgress
                completedCount={0}
                totalCount={1}
                isGenerating={true}
              />
            ) : (
              <div style={successPanelStyle}>
                <div style={successIconStyle}>✓</div>
                <div>
                  <strong style={statusTitleStyle}>生成任务已提交成功</strong>
                  <p style={statusTextStyle}>正在打开创作历史，音频生成完成后会在作品列表中更新。</p>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(229, 57, 53, 0.32)',
              background: 'rgba(229, 57, 53, 0.1)',
              color: '#ff8a80',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || isSensitivityLoading || isSubmitted}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '14px 24px',
            borderRadius: 999,
            border: 'none',
            background: isGenerating || isSensitivityLoading || isSubmitted ? '#20222b' : '#ceff35',
            color: isGenerating || isSensitivityLoading || isSubmitted ? 'var(--hc-text-weak)' : '#08090c',
            fontSize: 15,
            fontWeight: 900,
            cursor: isGenerating || isSensitivityLoading || isSubmitted ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--hc-font)',
            transition: 'all 0.2s ease',
          }}
        >
          {isSensitivityLoading ? '安全检查中...' : isGenerating ? '提交生成任务中...' : isSubmitted ? '任务已提交' : '开始生成'}
        </button>
      </section>

      <SensitivityConfirmDialog
        open={showConfirmDialog}
        styleTags={sensitivityResult?.styleTagsCn || sensitivityResult?.styleTags || []}
        onConfirm={handleSensitivityConfirm}
        onCancel={handleSensitivityCancel}
      />
      <SensitivityBlockDialog
        open={showBlockDialog}
        blockedWords={sensitivityResult?.blockedWords || []}
        source="description"
        onClose={handleBlockClose}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const statusPanelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '18px 20px',
  borderRadius: 14,
  border: '1px solid rgba(206,255,53,0.22)',
  background: 'rgba(206,255,53,0.07)',
};

const successPanelStyle: React.CSSProperties = {
  ...statusPanelStyle,
  border: '1px solid rgba(82,214,198,0.32)',
  background: 'rgba(82,214,198,0.08)',
};

const spinnerStyle: React.CSSProperties = {
  flex: '0 0 auto',
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: '3px solid rgba(255,255,255,0.12)',
  borderTopColor: '#ceff35',
  animation: 'spin 1s linear infinite',
};

const successIconStyle: React.CSSProperties = {
  flex: '0 0 auto',
  width: 34,
  height: 34,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))',
  color: '#08090c',
  fontSize: 18,
  fontWeight: 950,
};

const statusTitleStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--hc-text)',
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 4,
};

const statusTextStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--hc-text-muted)',
  fontSize: 12,
  lineHeight: 1.6,
};
