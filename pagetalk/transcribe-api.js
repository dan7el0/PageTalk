const API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const FREE_API_ENDPOINT = 'https://c0rpr74ughd0-deploy.space.z.ai/api/asr-inference';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function callFreeASRAPI(audioBlob, options) {
  const base64 = await blobToBase64(audioBlob);
  const payload = {
    audio_file: { data: base64, name: 'recording.dat', type: audioBlob.type, size: audioBlob.size },
    context: options.context || '',
    language: options.language || 'auto',
    enable_itn: !!options.enable_itn
  };
  const response = await chrome.runtime.sendMessage({
    type: 'callASRAPI',
    payload: {
      url: FREE_API_ENDPOINT,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    }
  });
  if (response.success && response.data.success) {
    const result = response.data.data;
    if (Array.isArray(result) && result.length >= 1) {
        return result[0];
    }
    throw new Error('API 未能返回有效文本');
  } else {
    throw new Error(response.data?.error || response.data?.details || response.error || '请求失败');
  }
}

export async function callDashScopeASRAPI(audioBlob, options) {
  if (!options.apiKey) {
    // Toast is handled by caller
    throw new Error('未提供阿里云百炼 API Key');
  }
  const base64 = await blobToBase64(audioBlob);
  const audioDataURI = `data:${audioBlob.type};base64,${base64}`;
  const system_parts = [];
  if (options.language && options.language !== 'auto') system_parts.push(`asr language:${options.language}`);
  if (options.context) system_parts.push(options.context);
  const messages = [];
  if (system_parts.length > 0) messages.push({ role: "system", content: [{ text: system_parts.join('\\n') }] });
  messages.push({ role: "user", content: [{ audio: audioDataURI }] });
  const payload = {
    model: "qwen3-asr-flash",
    input: { messages },
    parameters: { asr_options: { enable_lid: options.language === 'auto', enable_itn: !!options.enable_itn } }
  };
  const response = await chrome.runtime.sendMessage({
    type: 'callASRAPI',
    payload: {
      url: API_ENDPOINT,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${options.apiKey}` },
        body: JSON.stringify(payload)
      }
    }
  });
  if (response.success) {
    const choice = response.data.output?.choices?.[0];
    if (choice?.finish_reason === 'stop' && choice.message?.content?.[0]?.text) {
      return choice.message.content[0].text;
    } else {
      throw new Error(response.data?.message || 'API 未能返回有效文本');
    }
  } else {
    throw new Error(response.error || '请求失败');
  }
}