document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('grant-mic');
    const statusEl = document.getElementById('grant-status');

    const setStatus = (message, color = '#aaa') => {
        statusEl.textContent = message;
        statusEl.style.color = color;
    };

    const updateButtonState = (state) => {
        if (state === 'granted') {
            btn.disabled = true;
            btn.textContent = '已授权';
            setStatus('权限已授予！您现在可以关闭此页面，并在扩展弹窗中选择您的麦克风。', '#22c55e');
        } else {
            btn.disabled = false;
            btn.textContent = '授予麦克风权限';
        }
    };

    btn.addEventListener('click', async () => {
        try {
            setStatus('正在请求权限...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('Microphone permission granted.');
            updateButtonState('granted');
        } catch (err) {
            console.error('getUserMedia failed:', err.name, err.message);
            let errorMessage = `授权失败：${err.name}`;
            if (err.name === 'NotAllowedError') {
                errorMessage = '授权失败：您拒绝了麦克风权限。请在浏览器地址栏的站点设置中手动开启。';
            }
            setStatus(errorMessage, '#ef4444');
        }
    });

    // Check initial state and monitor changes
    const checkPermission = (permissionStatus) => {
        updateButtonState(permissionStatus.state);
        permissionStatus.onchange = () => {
            updateButtonState(permissionStatus.state);
        };
    };

    navigator.permissions.query({ name: 'microphone' })
        .then(checkPermission)
        .catch(err => {
            console.error("Permission API not supported or failed:", err);
            setStatus("无法检查权限状态。请尝试点击按钮授权。");
        });
});
