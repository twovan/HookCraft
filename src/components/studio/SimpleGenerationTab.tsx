'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GenerationProgress from '@/components/studio/GenerationProgress';
import SensitivityBlockDialog from '@/components/studio/SensitivityBlockDialog';
import SensitivityConfirmDialog from '@/components/studio/SensitivityConfirmDialog';
import FloatingGenerateButton from '@/components/studio/FloatingGenerateButton';
import { useSensitivityCheck } from '@/hooks/useSensitivityCheck';
import { CREDITS_COST } from '@/config/creditsCost';

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

const VISIBLE_PROMPT_EXAMPLES = SIMPLE_PROMPT_EXAMPLES.slice(0, 6);

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
  const generateMissingSteps = prompt.trim() ? [] : ['请填写生成描述'];
  const generateButtonDisabled = isGenerating || isSensitivityLoading || isSubmitted || generateMissingSteps.length > 0;
  const generateButtonText = isSensitivityLoading
    ? '安全检查中...'
    : isGenerating
      ? '提交生成任务中...'
      : isSubmitted
        ? '任务已提交'
        : generateMissingSteps.length > 0
          ? `开始创作（${generateMissingSteps.join('，')}）`
          : '开始创作';

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

  const handleUsePrompt = (nextPrompt: string) => {
    setPrompt(nextPrompt);
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
      <section className="studio-card simple-generation-shell" style={simpleShellStyle}>
        <div style={simpleMainStyle}>
          <div style={simpleHeaderStyle}>
            <div>
              <span style={modeBadgeStyle}>Simple Studio</span>
              <h2 style={simpleTitleStyle}>简单模式</h2>
              <p style={simpleSubtitleStyle}>输入一句创作描述，自动完成风格、歌词与生成配置。</p>
            </div>
            <button
              type="button"
              onClick={handleUseExample}
              disabled={isGenerating || isSensitivityLoading || isSubmitted}
              style={ghostButtonStyle(isGenerating || isSensitivityLoading || isSubmitted)}
            >
              换个灵感
            </button>
          </div>

          <label htmlFor="simple-generation-prompt" style={fieldLabelStyle}>
            生成描述
          </label>
          <textarea
            id="simple-generation-prompt"
            value={prompt}
            maxLength={500}
            onChange={(event) => handleUsePrompt(event.target.value)}
            placeholder="例如：一首适合短视频开场的明亮流行歌，旋律轻快，有夏日感"
            style={promptTextareaStyle}
          />

          <div style={inputMetaStyle}>
            <label style={checkboxLabelStyle}>
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
            <div role="alert" style={errorPanelStyle}>
              {error}
            </div>
          )}

        </div>

        <aside style={simpleSideStyle}>
          <div style={sidePanelStyle}>
            <div style={sidePanelHeaderStyle}>
              <span style={sideEyebrowStyle}>灵感样本</span>
              <span style={sideCountStyle}>{VISIBLE_PROMPT_EXAMPLES.length}</span>
            </div>
            <div style={promptChipListStyle}>
              {VISIBLE_PROMPT_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => handleUsePrompt(example)}
                  disabled={isGenerating || isSensitivityLoading || isSubmitted}
                  style={promptChipStyle(isGenerating || isSensitivityLoading || isSubmitted)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div style={quietNoteStyle}>
            生成提交成功后会进入「我的作品」，音频完成时自动补齐播放器。
          </div>
        </aside>

        <FloatingGenerateButton
          onClick={handleGenerate}
          disabled={generateButtonDisabled}
          busy={isGenerating || isSensitivityLoading}
          creditLabel={`${CREDITS_COST.cover_generation} 积分`}
          containerStyle={{ gridColumn: '1 / -1' }}
        >
          {generateButtonText}
        </FloatingGenerateButton>
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
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 920px) {
          .simple-generation-shell {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </>
  );
}

const simpleShellStyle: React.CSSProperties = {
  width: '100%',
  margin: '0 auto',
  padding: 20,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.105)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.048), rgba(255,255,255,0.018))',
  boxShadow: '0 18px 48px rgba(0,0,0,.24)',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 340px',
  gap: 18,
};

const simpleMainStyle: React.CSSProperties = {
  minWidth: 0,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(8, 9, 12, 0.52)',
  padding: 20,
};

const simpleSideStyle: React.CSSProperties = {
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const simpleHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  marginBottom: 20,
};

const modeBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 9px',
  borderRadius: 999,
  border: '1px solid rgba(206,255,53,0.24)',
  color: 'var(--hc-lime)',
  background: 'rgba(206,255,53,0.08)',
  fontSize: 11,
  fontWeight: 900,
};

const simpleTitleStyle: React.CSSProperties = {
  margin: '10px 0 8px',
  color: 'var(--hc-text)',
  fontSize: 28,
  lineHeight: 1.1,
  fontWeight: 950,
  fontFamily: 'var(--hc-font)',
};

const simpleSubtitleStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--hc-text-muted)',
  fontSize: 13,
  lineHeight: 1.7,
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 8,
  color: 'var(--hc-text)',
  fontSize: 13,
  fontWeight: 850,
  fontFamily: 'var(--hc-font)',
};

const promptTextareaStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 184,
  padding: '16px 17px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(7,8,11,.86)',
  color: 'var(--hc-text)',
  fontSize: 14,
  lineHeight: 1.7,
  resize: 'vertical',
  outline: 'none',
  fontFamily: 'var(--hc-font)',
};

const inputMetaStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 10,
  color: 'var(--hc-text-muted)',
  fontSize: 12,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
};

const ghostButtonStyle = (disabled: boolean): React.CSSProperties => ({
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 36,
  padding: '0 13px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(17,20,27,0.9)',
  color: 'var(--hc-text)',
  fontSize: 12,
  fontWeight: 850,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.56 : 1,
  fontFamily: 'var(--hc-font)',
});

const errorPanelStyle: React.CSSProperties = {
  marginTop: 16,
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(229, 57, 53, 0.32)',
  background: 'rgba(229, 57, 53, 0.1)',
  color: '#ff8a80',
  fontSize: 13,
  lineHeight: 1.6,
};

const sidePanelStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(8, 9, 12, 0.44)',
  padding: 14,
};

const sidePanelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 10,
};

const sideEyebrowStyle: React.CSSProperties = {
  color: 'var(--hc-lime)',
  fontSize: 11,
  fontWeight: 950,
};

const sideCountStyle: React.CSSProperties = {
  minWidth: 24,
  height: 24,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--hc-text-muted)',
  fontSize: 11,
  fontWeight: 900,
};

const promptChipListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
};

const promptChipStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 11,
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--hc-text)',
  padding: '10px 11px',
  textAlign: 'left',
  fontSize: 12,
  lineHeight: 1.55,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.56 : 1,
  fontFamily: 'var(--hc-font)',
});

const quietNoteStyle: React.CSSProperties = {
  marginTop: 'auto',
  borderRadius: 14,
  border: '1px solid rgba(82,214,198,0.18)',
  background: 'rgba(82,214,198,0.06)',
  color: 'var(--hc-text-muted)',
  padding: 14,
  fontSize: 12,
  lineHeight: 1.6,
};

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
