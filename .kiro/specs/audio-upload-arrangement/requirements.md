# Requirements Document

## Introduction

本文档定义了"上传音频生成编曲"功能的需求规格。该功能在现有 AI 创作中心（/studio 页面）中新增一个 Tab 页面，集成 MiniMax 音乐生成 API（music-cover 模型），允许用户上传参考音频并通过自定义参数生成编曲或完整歌曲。

## Glossary

- **System**: 指 AI 音乐创作平台的整体系统，包括前端 UI 和后端服务
- **AudioUploadTab**: /studio 页面中负责音频上传编曲功能的 Tab 容器组件
- **AudioUploader**: 处理音频文件拖拽上传、格式校验和波形可视化的子组件
- **ParamEditor**: 右侧参数编辑面板组件，包含时长、BPM、调性、乐器等定制化选项
- **MiniMaxProvider**: 封装 MiniMax API 调用的服务层组件
- **CreditService**: 管理用户 Credits 余额和消费的服务
- **SensitivityCheck**: 敏感词检查服务
- **Preprocess_API**: MiniMax /v1/music_cover_preprocess 接口，用于提取音频特征和歌词结构
- **Generation_API**: MiniMax /v1/music_generation 接口，用于生成编曲或完整歌曲
- **CoverFeatureId**: 预处理 API 返回的音频特征标识符，用于后续生成请求
- **ArrangementParams**: 用户定制的编曲参数集合，包括时长、BPM、调性、音阶、乐器、Prompt 等

## Requirements

### Requirement 1: 音频文件上传

**User Story:** As a 音乐创作者, I want to 上传参考音频文件, so that 系统可以基于该音频生成编曲。

#### Acceptance Criteria

1. WHEN a user drags an audio file into the upload area or clicks to select a file, THE AudioUploader SHALL accept the file and display a validating state while performing client-side validation in the order: format, then size, then duration
2. WHEN the uploaded file format is MP3 or WAV, THE AudioUploader SHALL mark the file as format-valid
3. IF the uploaded file format is not MP3 or WAV, THEN THE AudioUploader SHALL display the error message "仅支持 MP3/WAV 格式" and reject the file
4. WHEN the uploaded file size is within 50MB, THE AudioUploader SHALL mark the file as size-valid
5. IF the uploaded file size exceeds 50MB, THEN THE AudioUploader SHALL display the error message "文件大小不能超过 50MB" and reject the file
6. WHEN the audio duration is between 6 seconds and 3 minutes (inclusive), THE AudioUploader SHALL mark the file as duration-valid
7. IF the audio duration is less than 6 seconds, THEN THE AudioUploader SHALL display the error message "音频时长不能少于 6 秒" and reject the file
8. IF the audio duration exceeds 3 minutes, THEN THE AudioUploader SHALL display the error message "音频时长不能超过 3 分钟" and reject the file
9. WHEN a file passes all validation checks, THE AudioUploader SHALL transition to the "ready" state and render a waveform visualization of the audio
10. IF the audio file cannot be decoded for duration detection, THEN THE AudioUploader SHALL display an error message indicating the file is corrupted or unreadable and reject the file
11. WHEN the AudioUploader is in the "ready" state and the user clicks the remove button, THE AudioUploader SHALL remove the file and return to the "idle" state
12. WHEN the AudioUploader is in the "ready" state and the user selects or drags a new file, THE AudioUploader SHALL replace the existing file and restart validation for the new file

### Requirement 2: 波形可视化

**User Story:** As a 音乐创作者, I want to 看到上传音频的波形图, so that 我可以直观确认上传的音频内容正确。

#### Acceptance Criteria

1. WHEN an audio file passes validation, THE AudioUploader SHALL decode the audio using Web Audio API and render a waveform visualization on a Canvas element within 3 seconds of file selection
2. WHEN the waveform is rendered, THE AudioUploader SHALL display the audio duration in mm:ss format (e.g., "2:35") adjacent to the waveform visualization
3. WHEN a user clicks the remove button, THE AudioUploader SHALL clear the uploaded file, release the AudioBuffer reference, reset the Canvas to empty, and return to the idle state
4. IF the Web Audio API fails to decode the audio file, THEN THE AudioUploader SHALL display an error message indicating the audio could not be parsed, retain the file reference for retry, and not render the waveform Canvas

### Requirement 3: 音频预处理

**User Story:** As a 音乐创作者, I want to 分析上传的音频以提取特征和歌词结构, so that 系统可以基于这些信息生成高质量编曲。

#### Acceptance Criteria

1. WHEN a user clicks the "分析音频" button with a validated audio file in ready state, THE System SHALL encode the audio as Base64 and send it to the /api/minimax/preprocess endpoint within 3 seconds of the click
2. WHEN the Preprocess_API returns successfully, THE System SHALL store the CoverFeatureId, extracted lyrics, structure result, and audio duration in component state for use by subsequent generation steps
3. WHEN preprocessing completes successfully, THE ParamEditor SHALL pre-fill the lyrics field with the extracted lyrics from the Preprocess_API response, preserving any structure tags (e.g., [verse], [chorus]) included in the response
4. IF the Preprocess_API returns an error or the request times out after 60 seconds, THEN THE System SHALL display "音频分析失败，请重试" and retain the uploaded file in ready state so the user can retry without re-uploading
5. WHILE preprocessing is in progress, THE System SHALL display a loading indicator and disable the "分析音频" button to prevent duplicate requests
6. IF no validated audio file is in ready state, THEN THE System SHALL disable the "分析音频" button

### Requirement 4: 编曲参数定制

**User Story:** As a 音乐创作者, I want to 自定义编曲参数（时长、BPM、调性、乐器、风格等）, so that 生成的编曲符合我的创作意图。

#### Acceptance Criteria

1. THE ParamEditor SHALL provide duration selection with options of 30, 60, 90, and 120 seconds, with a default value of 60 seconds
2. THE ParamEditor SHALL provide a BPM slider with range 60 to 200, step increment of 1, and a default value of 120
3. THE ParamEditor SHALL provide a musical key selector with all 12 semitones (C, C#, D, D#, E, F, F#, G, G#, A, A#, B), with a default value of C
4. THE ParamEditor SHALL provide a scale selector with options: major, minor, dorian, mixolydian, pentatonic, with a default value of major
5. THE ParamEditor SHALL provide a multi-select instrument tag selector allowing a minimum of 1 and a maximum of 10 instrument selections
6. THE ParamEditor SHALL provide a text input for style description prompt with a maximum length of 2000 characters, where the field is optional and may be left empty
7. THE ParamEditor SHALL provide a lyrics text editor that is pre-filled with extracted lyrics from preprocessing, with a maximum length of 3500 characters
8. THE ParamEditor SHALL provide an instrumental mode toggle that disables the lyrics editor when enabled and preserves the existing lyrics content so it is restored when the toggle is disabled
9. THE ParamEditor SHALL provide an output format selector with options MP3 and WAV, with a default value of MP3
10. WHILE preprocessing has not completed successfully, THE ParamEditor SHALL disable the generate button and display the parameter controls in a read-only state

### Requirement 5: Prompt 构建

**User Story:** As a 系统, I want to 将用户参数组合成有效的 Prompt, so that MiniMax API 能正确理解生成意图。

#### Acceptance Criteria

1. WHEN generating an arrangement, THE System SHALL build a prompt string that includes the BPM value, musical key name, scale name, and all selected instrument names as literal text
2. IF the built prompt length exceeds 2000 characters, THEN THE System SHALL truncate the prompt to 2000 characters and proceed with the truncated version
3. WHEN the user provides a non-empty style description, THE System SHALL append the user's style description text to the end of the constructed prompt
4. WHEN instrumental mode is disabled, THE System SHALL validate that lyrics contain at least one structure tag ([verse], [chorus], [bridge], [intro], or [outro])
5. IF instrumental mode is disabled and the lyrics do not contain any structure tag, THEN THE System SHALL reject the generation request and display an error message indicating that at least one structure tag is required
6. WHEN no instruments are selected, THE System SHALL build the prompt using only BPM, musical key, and scale without an instruments segment

### Requirement 6: 编曲生成

**User Story:** As a 音乐创作者, I want to 基于上传的音频和自定义参数生成编曲, so that 我可以获得 AI 辅助创作的音乐作品。

#### Acceptance Criteria

1. WHEN a user clicks the "生成编曲" button, THE System SHALL verify the user has sufficient Credits for the arrangement_generation operation via CreditService before sending the generation request
2. IF the user does not have sufficient Credits, THEN THE System SHALL display "Credits 余额不足" and provide a link to the recharge page without sending the generation request
3. IF the CreditService check fails due to a network or service error, THEN THE System SHALL display an error message indicating the credits verification failed and allow the user to retry
4. WHEN Credits are verified as sufficient, THE System SHALL send the generation request to the /api/minimax/generate endpoint with CoverFeatureId, lyrics, prompt, and audioSetting (including sampleRate, bitrate, and format)
5. WHEN the Generation_API returns a successful result, THE System SHALL consume the user's Credits for the arrangement_generation operation via CreditService
6. IF the Generation_API returns an error, THEN THE System SHALL display an error message indicating the generation failure reason and not consume any Credits
7. WHEN generation completes successfully, THE System SHALL store the generated audio file in Supabase Storage and create a generation_tasks record with generation_type set to "arrangement" in the database
8. WHILE generation is in progress, THE System SHALL display a progress indicator and disable the "生成编曲" button
9. IF the Generation_API does not respond within 300 seconds, THEN THE System SHALL treat the request as failed, display a timeout error message, and not consume any Credits

### Requirement 7: 敏感词检查

**User Story:** As a 平台运营者, I want to 对用户输入的 Prompt 和歌词进行敏感词检查, so that 平台内容符合合规要求。

#### Acceptance Criteria

1. WHEN a generation request is received, THE System SHALL execute SensitivityCheck on the user-provided prompt text before calling the Generation_API
2. WHEN a generation request contains lyrics, THE System SHALL execute SensitivityCheck on the lyrics content before calling the Generation_API; IF any category of sensitive word (celebrity, song_name, or forbidden) is detected in lyrics, THEN THE System SHALL block the request
3. IF SensitivityCheck detects a forbidden-category word in the prompt text, THEN THE System SHALL reject the generation request and display a message indicating which words triggered the violation
4. IF SensitivityCheck detects a celebrity or song_name-category word in the prompt text, THEN THE System SHALL provide a rewritten prompt that removes the sensitive reference while preserving the user's creative intent, and present the rewritten prompt to the user for confirmation before proceeding
5. IF the SensitivityCheck service is unavailable or times out within 30 seconds, THEN THE System SHALL fall back to local word-matching only; IF local matching detects no sensitive words, THEN THE System SHALL allow the request to proceed

### Requirement 8: 认证与权限

**User Story:** As a 平台运营者, I want to 确保只有已登录用户可以使用编曲功能, so that 系统资源得到合理保护。

#### Acceptance Criteria

1. WHEN a request is received on the /api/minimax/preprocess endpoint, THE System SHALL verify user authentication by validating the session token before processing the request
2. WHEN a request is received on the /api/minimax/generate endpoint, THE System SHALL verify user authentication by validating the session token before processing the request
3. IF an unauthenticated request is received on either /api/minimax/preprocess or /api/minimax/generate, THEN THE System SHALL return a 401 status code with a JSON response body containing an error message indicating the user is not logged in, and SHALL NOT process the request further
4. THE System SHALL enforce user-level rate limiting on both /api/minimax/preprocess and /api/minimax/generate endpoints, allowing a maximum of 10 requests per user per minute per endpoint
5. IF a user exceeds the rate limit, THEN THE System SHALL return a 429 status code with a JSON response body containing an error message indicating the rate limit has been exceeded, and SHALL NOT process the request

### Requirement 9: Tab 页面集成

**User Story:** As a 音乐创作者, I want to 在 /studio 页面中通过 Tab 切换访问音频上传编曲功能, so that 我可以方便地在不同创作模式间切换。

#### Acceptance Criteria

1. THE System SHALL display the AudioUploadTab as a selectable tab alongside the existing "Template Generate Song" tab on the /studio page, with the "Template Generate Song" tab active by default on initial page load
2. WHEN a user switches between tabs, THE System SHALL preserve the state of each tab independently, including uploaded files, preprocessing results, form input values, and generation results, such that returning to a previously visited tab restores its last state without requiring the user to re-enter data
3. WHEN the AudioUploadTab is active, THE System SHALL display a two-column split layout with the audio upload area occupying the left column and the parameter editing area occupying the right column
4. WHEN a user clicks a tab that is not currently active, THE System SHALL switch the displayed content to the selected tab's view within 200 milliseconds without triggering a full page reload

### Requirement 10: 服务端安全校验

**User Story:** As a 平台运营者, I want to 在服务端对上传文件进行二次校验, so that 恶意用户无法绕过客户端限制。

#### Acceptance Criteria

1. WHEN the /api/minimax/preprocess endpoint receives a request with audio data exceeding 50MB, THE System SHALL reject the request with an error response indicating the file size exceeds the maximum allowed limit, without forwarding the request to the MiniMax API
2. WHEN the /api/minimax/preprocess endpoint receives a request with an audio MIME type other than MP3 (audio/mpeg) or WAV (audio/wav, audio/x-wav), THE System SHALL reject the request with an error response indicating the file format is unsupported, without forwarding the request to the MiniMax API
3. THE System SHALL store the MiniMax API Key exclusively in server-side environment variables and SHALL NOT include it in any API response body, client-side bundle, or browser-accessible resource
4. IF the /api/minimax/preprocess endpoint receives a request with missing or empty audio data, THEN THE System SHALL reject the request with an error response indicating that audio data is required
5. WHEN the /api/minimax/preprocess endpoint receives a request with audio duration less than 6 seconds or greater than 3 minutes, THE System SHALL reject the request with an error response indicating the audio duration is outside the allowed range of 6 seconds to 180 seconds

### Requirement 11: 生成结果展示与播放

**User Story:** As a 音乐创作者, I want to 在生成完成后立即试听结果, so that 我可以评估生成质量并决定是否重新生成。

#### Acceptance Criteria

1. WHEN generation completes successfully, THE System SHALL display an audio player within 2 seconds that provides play, pause, seek, and volume controls for the generated audio
2. WHEN generation completes successfully AND the generation mode is non-instrumental, THE System SHALL display the generated lyrics text alongside the audio player
3. WHEN the user activates the regenerate action from the result view, THE System SHALL present the parameter editing interface pre-filled with the previous generation's parameters (BPM, key, scale, instruments, prompt, lyrics) and allow submission of a new generation request without requiring re-upload of the source audio
4. IF generation fails, THEN THE System SHALL display an error message indicating the failure reason, preserve the uploaded audio file and previously entered parameters, and allow the user to modify parameters and retry generation

### Requirement 12: 错误恢复

**User Story:** As a 音乐创作者, I want to 在发生错误时能够恢复操作, so that 我不需要从头开始整个流程。

#### Acceptance Criteria

1. IF a network interruption occurs during generation, THEN THE System SHALL display "网络连接中断" within 10 seconds of connection loss, preserve the generation task record (including coverFeatureId, lyrics, prompt, and parameters) in the database with a status of "interrupted", and retain the uploaded audio file in client memory
2. WHEN a user refreshes the page after a network interruption, THE System SHALL automatically query the database for any pending or completed generation tasks belonging to the user and display the task status (generating, completed, or failed) within the page, allowing the user to retrieve the result if generation has completed
3. IF preprocessing fails, THEN THE System SHALL retain the uploaded audio file in client memory, display an error message indicating the preprocessing failure reason, and provide a "重新分析" button that allows the user to retry preprocessing without re-uploading, for up to 3 retry attempts
4. IF a preprocessing error occurs, THEN THE System SHALL return to the "ready" state (audio uploaded and validated, awaiting preprocessing)
5. IF a generation error occurs after preprocessing has completed, THEN THE System SHALL return to the "preprocessing-completed" state (coverFeatureId and extracted lyrics preserved, parameters editable for retry)

### Requirement 13: 性能优化

**User Story:** As a 音乐创作者, I want to 上传和处理大文件时界面保持流畅, so that 我的创作体验不受影响。

#### Acceptance Criteria

1. WHEN encoding an audio file of 1 MB or larger to Base64, THE System SHALL perform the encoding in a Web Worker to avoid blocking the main UI thread, maintaining a frame rate of at least 30 FPS during the encoding process
2. WHEN rendering waveform visualization for an audio file exceeding 60 seconds in duration, THE System SHALL downsample the audio data to a maximum of 2000 data points before rendering, completing the render within 500 milliseconds
3. WHEN an audio file upload is complete and Base64 encoding is done, THE System SHALL set the AudioBuffer and Base64 string references to null within the same event loop tick so that the memory becomes eligible for garbage collection
4. THE /api/minimax/generate endpoint SHALL set a maximum execution duration of 300 seconds to accommodate Vercel serverless timeout limits
5. WHILE a Web Worker is performing Base64 encoding, IF the user navigates away from the upload page, THEN THE System SHALL terminate the Web Worker to prevent unnecessary resource consumption
