/**
 * 管理员登录页面脚本
 */

// 全局变量
const API_BASE = window.location.origin + '/api';

// DOM 元素
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const loading = document.getElementById('loading');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否已经登录
    checkExistingLogin();
    
    // 绑定表单提交事件
    loginForm.addEventListener('submit', handleLogin);
    
    // 绑定输入框回车事件
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            passwordInput.focus();
        }
    });
    
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });
    
    // 忘记密码链接处理
    document.querySelector('.forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        alert('请联系系统管理员重置密码');
    });
});

// 检查现有登录状态
function checkExistingLogin() {
    const token = localStorage.getItem('adminToken');
    if (token) {
        // 验证token是否有效
        validateToken(token);
    }
}

// 验证token有效性
async function validateToken(token) {
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            // token有效，直接跳转到管理员控制台
            window.location.href = '/admin.html';
        } else {
            // token无效，清除本地存储
            localStorage.removeItem('adminToken');
            hideLoading();
        }
    } catch (error) {
        console.error('Token验证失败:', error);
        localStorage.removeItem('adminToken');
        hideLoading();
    }
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const remember = document.getElementById('remember').checked;
    
    // 基本验证
    if (!username || !password) {
        showError('请输入用户名和密码');
        return;
    }
    
    try {
        showLoading();
        hideMessages();
        
        // 发送登录请求
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 登录成功
            handleLoginSuccess(data.data, remember);
        } else {
            // 登录失败
            showError(data.message || '登录失败，请检查用户名和密码');
        }
        
    } catch (error) {
        console.error('登录请求失败:', error);
        showError('网络错误，请稍后重试');
    } finally {
        hideLoading();
    }
}

// 处理登录成功
function handleLoginSuccess(data, remember) {
    // 存储token
    if (remember) {
        localStorage.setItem('adminToken', data.token);
    } else {
        sessionStorage.setItem('adminToken', data.token);
    }
    
    // 显示成功消息
    showSuccess('登录成功，正在跳转...');
    
    // 延迟跳转，让用户看到成功消息
    setTimeout(() => {
        window.location.href = '/admin.html';
    }, 1000);
}

// 显示加载状态
function showLoading() {
    loading.style.display = 'block';
    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';
}

// 隐藏加载状态
function hideLoading() {
    loading.style.display = 'none';
    loginBtn.disabled = false;
    loginBtn.textContent = '登录管理员控制台';
}

// 显示错误消息
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
    
    // 3秒后自动隐藏
    setTimeout(hideMessages, 3000);
}

// 显示成功消息
function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

// 隐藏所有消息
function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// 工具函数：格式化错误信息
function formatErrorMessage(error) {
    if (typeof error === 'string') {
        return error;
    }
    
    if (error.message) {
        return error.message;
    }
    
    return '发生未知错误，请稍后重试';
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    // 清理可能存在的定时器
    hideLoading();
});