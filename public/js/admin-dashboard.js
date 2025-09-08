/**
 * 管理员控制台 - 主要功能模块
 * 包含所有图表、数据管理和用户交互功能
 */

// ==================== 全局变量 ====================
let currentUser = null;
let authToken = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
let charts = {};
let updateTimer = null;
let currentTab = 'overview';
let currentPage = 1;
let currentUsers = [];
let totalUsers = 0;

// API基础配置
const API_BASE = window.location.origin + '/api';
const UPDATE_INTERVAL = 30000; // 30秒

// ==================== API 管理 ====================
class APIManager {
    static async request(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, finalOptions);
            
            if (!response.ok) {
                if (response.status === 401) {
                    // 认证失败，重定向到管理员登录页面
                    localStorage.removeItem('adminToken');
                    sessionStorage.removeItem('adminToken');
                    window.location.href = '/admin-login.html';
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API请求失败:', error);
            showToast(`API请求失败: ${error.message}`, 'error');
            throw error;
        }
    }

    static async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// ==================== Toast 通知 ====================
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toast.className = `toast ${type}`;
    toastMessage.textContent = message;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// ==================== 加载状态管理 ====================
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

// ==================== Tab 管理 ====================
function initTabs() {
    const tabButtons = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // 更新内容区域
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    currentTab = tabName;
    
    // 加载相应的数据
    loadTabData(tabName);
}

// ==================== 数据加载 ====================
async function loadTabData(tabName) {
    try {
        switch (tabName) {
            case 'overview':
                await loadOverviewData();
                break;
            case 'users':
                await loadUsersData();
                break;
            case 'geography':
                await loadGeographyData();
                break;
            case 'devices':
                await loadDeviceData();
                break;
            case 'security':
                await loadSecurityData();
                break;
        }
    } catch (error) {
        console.error(`加载${tabName}数据失败:`, error);
    }
}

// ==================== 总览数据 ====================
async function loadOverviewData() {
    try {
        // 获取实时数据
        const realTimeData = await APIManager.get('/admin/real-time-data');
        updateStatsCards(realTimeData.data.stats);
        updateRecentActivity(realTimeData.data.recentLogins);
        
        // 初始化图表
        await initCharts();
        
    } catch (error) {
        console.error('加载总览数据失败:', error);
    }
}

function updateStatsCards(stats) {
    document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
    document.getElementById('activeUsers').textContent = stats.activeUsers || 0;
    document.getElementById('totalPoints').textContent = (stats.totalPoints || 0).toLocaleString();
    document.getElementById('todayLogins').textContent = stats.todayLogins || 0;
    document.getElementById('todayRegistrations').textContent = stats.todayRegistrations || 0;
    document.getElementById('failedLogins').textContent = stats.failedLogins || 0;
}

function updateRecentActivity(recentLogins) {
    const activityList = document.getElementById('recentActivity');
    if (!recentLogins || recentLogins.length === 0) {
        activityList.innerHTML = '<div style="padding: 2rem; text-align: center; color: #6b7280;">暂无最近活动</div>';
        return;
    }

    activityList.innerHTML = recentLogins.map(login => `
        <div class="activity-item">
            <div class="activity-icon success">👤</div>
            <div class="activity-content">
                <div class="activity-title">${login.username} 登录成功</div>
                <div class="activity-description">来自 ${login.location_city || '未知'}, ${login.location_country || '未知'} - ${login.last_login_ip}</div>
            </div>
            <div class="activity-time">${formatRelativeTime(login.last_login_time)}</div>
        </div>
    `).join('');
}

// ==================== 图表初始化 ====================
async function initCharts() {
    try {
        // 用户增长趋势图
        await initUserGrowthChart();
        
        // 地理分布图
        await initLocationChart();
        
        // 设备类型图
        await initDeviceChart();
        
        // 浏览器分布图
        await initBrowserChart();
        
    } catch (error) {
        console.error('初始化图表失败:', error);
    }
}

async function initUserGrowthChart() {
    const ctx = document.getElementById('userGrowthChart');
    if (!ctx) return;

    // 模拟用户增长数据
    const labels = [];
    const data = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
        data.push(Math.floor(Math.random() * 20) + 5); // 模拟数据
    }

    charts.userGrowth = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '新用户',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f3f4f6'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

async function initLocationChart() {
    try {
        const locationData = await APIManager.get('/admin/location-stats');
        const ctx = document.getElementById('locationChart');
        if (!ctx || !locationData.data) return;

        const regions = locationData.data.regions.slice(0, 10);
        
        charts.location = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: regions.map(r => r.region),
                datasets: [{
                    label: '用户数量',
                    data: regions.map(r => r.count),
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('初始化地理分布图失败:', error);
    }
}

async function initDeviceChart() {
    try {
        const deviceData = await APIManager.get('/admin/device-stats');
        const ctx = document.getElementById('deviceChart');
        if (!ctx || !deviceData.data) return;

        const deviceTypes = deviceData.data.deviceTypes;
        
        charts.device = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: deviceTypes.map(d => d.device_type),
                datasets: [{
                    data: deviceTypes.map(d => d.count),
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981', 
                        '#f59e0b',
                        '#ef4444',
                        '#8b5cf6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    } catch (error) {
        console.error('初始化设备类型图失败:', error);
    }
}

async function initBrowserChart() {
    try {
        const deviceData = await APIManager.get('/admin/device-stats');
        const ctx = document.getElementById('browserChart');
        if (!ctx || !deviceData.data) return;

        const browsers = deviceData.data.browsers;
        
        charts.browser = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: browsers.map(b => b.browser),
                datasets: [{
                    data: browsers.map(b => b.count),
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b', 
                        '#ef4444',
                        '#8b5cf6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    } catch (error) {
        console.error('初始化浏览器分布图失败:', error);
    }
}

// ==================== 用户管理 ====================
async function loadUsersData() {
    try {
        const searchTerm = document.getElementById('userSearch').value;
        const sortBy = document.getElementById('sortBy').value;
        const sortOrder = document.getElementById('sortOrder').value;
        
        const params = new URLSearchParams({
            page: currentPage,
            limit: 10,
            search: searchTerm,
            sortBy: sortBy,
            sortOrder: sortOrder
        });

        const response = await APIManager.get(`/admin/users-enhanced?${params}`);
        currentUsers = response.data.users;
        totalUsers = response.data.pagination.total;
        
        renderUserTable(currentUsers);
        renderPagination(response.data.pagination);
        
    } catch (error) {
        console.error('加载用户数据失败:', error);
        showToast('加载用户数据失败', 'error');
    }
}

function renderUserTable(users) {
    const tbody = document.getElementById('userTableBody');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 2rem;">暂无用户数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td><input type="checkbox" data-user-id="${user.id}"></td>
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.points}</td>
            <td>
                <span class="user-status ${user.status}">
                    ${user.status === 'active' ? '活跃' : '已禁用'}
                </span>
            </td>
            <td>${user.last_login_ip || '-'}</td>
            <td>${user.location_city || '-'}, ${user.location_region || '-'}</td>
            <td>${getDeviceIcon(user.device_info)} ${getDeviceType(user.device_info)}</td>
            <td>${formatRelativeTime(user.last_login_time)}</td>
            <td>${user.login_count || 0}</td>
            <td>
                <div class="user-actions">
                    <button class="action-btn primary" onclick="showUserDetail(${user.id})">详情</button>
                    <button class="action-btn warning" onclick="editUserPoints(${user.id})">积分</button>
                    <button class="action-btn danger" onclick="toggleUserStatus(${user.id})">${user.status === 'active' ? '禁用' : '启用'}</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderPagination(pagination) {
    const info = document.getElementById('paginationInfo');
    const controls = document.getElementById('pageNumbers');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    // 更新信息
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    info.textContent = `显示 ${start} - ${end} 条，共 ${pagination.total} 条记录`;
    
    // 更新按钮状态
    prevBtn.disabled = pagination.page <= 1;
    nextBtn.disabled = pagination.page >= pagination.pages;
    
    // 生成页码
    const pageNumbers = [];
    const currentPage = pagination.page;
    const totalPages = pagination.pages;
    
    // 计算显示的页码范围
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (endPage - startPage < 4) {
        if (startPage === 1) {
            endPage = Math.min(totalPages, startPage + 4);
        } else {
            startPage = Math.max(1, endPage - 4);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(`
            <button class="page-number ${i === currentPage ? 'active' : ''}" 
                    onclick="goToPage(${i})">${i}</button>
        `);
    }
    
    controls.innerHTML = pageNumbers.join('');
}

function goToPage(page) {
    currentPage = page;
    loadUsersData();
}

// ==================== 用户详情和操作 ====================
async function showUserDetail(userId) {
    try {
        const response = await APIManager.get(`/admin/user/${userId}`);
        const user = response.data;
        
        // 显示模态框
        const modal = document.getElementById('userModal');
        document.getElementById('modalTitle').textContent = `用户详情 - ${user.username}`;
        
        // 填充基本信息
        document.getElementById('basic-detail').innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div>
                    <strong>用户ID:</strong> ${user.id}<br>
                    <strong>用户名:</strong> ${user.username}<br>
                    <strong>邮箱:</strong> ${user.email}<br>
                    <strong>积分:</strong> ${user.points}<br>
                    <strong>状态:</strong> <span class="user-status ${user.status}">${user.status === 'active' ? '活跃' : '已禁用'}</span>
                </div>
                <div>
                    <strong>注册时间:</strong> ${formatDateTime(user.register_time)}<br>
                    <strong>注册IP:</strong> ${user.register_ip || '-'}<br>
                    <strong>最后登录:</strong> ${formatDateTime(user.last_login_time)}<br>
                    <strong>登录次数:</strong> ${user.login_count || 0}<br>
                    <strong>最后登录IP:</strong> ${user.last_login_ip || '-'}
                </div>
            </div>
        `;
        
        // 填充地理位置信息
        document.getElementById('device-detail').innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div>
                    <strong>国家:</strong> ${user.location_country || '-'}<br>
                    <strong>省份:</strong> ${user.location_region || '-'}<br>
                    <strong>城市:</strong> ${user.location_city || '-'}<br>
                    <strong>时区:</strong> ${user.timezone || '-'}
                </div>
                <div>
                    <strong>设备指纹:</strong> ${user.device_fingerprint || '-'}<br>
                    <strong>屏幕分辨率:</strong> ${user.screen_resolution || '-'}<br>
                    <strong>用户代理:</strong> <div style="word-break: break-all; font-size: 0.8em; margin-top: 0.5em;">${user.user_agent_full || '-'}</div>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        
    } catch (error) {
        console.error('获取用户详情失败:', error);
        showToast('获取用户详情失败', 'error');
    }
}

async function editUserPoints(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('pointsUserName').textContent = user.username;
    document.getElementById('currentPoints').textContent = user.points;
    document.getElementById('pointsForm').dataset.userId = userId;
    
    document.getElementById('pointsModal').classList.add('active');
}

// ==================== 地理数据 ====================
async function loadGeographyData() {
    try {
        const geoData = await APIManager.get('/admin/location-stats');
        
        // 初始化国家和城市图表
        initCountryChart(geoData.data.countries);
        initCityChart(geoData.data.cities);
        
        // 显示地理统计
        renderGeoStats(geoData.data);
        
    } catch (error) {
        console.error('加载地理数据失败:', error);
    }
}

function initCountryChart(countries) {
    const ctx = document.getElementById('countryChart');
    if (!ctx || !countries) return;
    
    if (charts.country) {
        charts.country.destroy();
    }
    
    charts.country = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countries.slice(0, 10).map(c => c.country),
            datasets: [{
                label: '用户数量',
                data: countries.slice(0, 10).map(c => c.count),
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                borderColor: '#10b981',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function initCityChart(cities) {
    const ctx = document.getElementById('cityChart');
    if (!ctx || !cities) return;
    
    if (charts.city) {
        charts.city.destroy();
    }
    
    charts.city = new Chart(ctx, {
        type: 'horizontalBar',
        data: {
            labels: cities.slice(0, 10).map(c => c.city),
            datasets: [{
                label: '用户数量',
                data: cities.slice(0, 10).map(c => c.count),
                backgroundColor: 'rgba(245, 158, 11, 0.6)',
                borderColor: '#f59e0b',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderGeoStats(geoData) {
    const statsContainer = document.getElementById('geoStats');
    statsContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
            <div style="text-align: center; padding: 1rem; background: #f3f4f6; border-radius: 0.5rem;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${geoData.countries.length}</div>
                <div style="font-size: 0.875rem; color: #6b7280;">覆盖国家</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: #f3f4f6; border-radius: 0.5rem;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${geoData.regions.length}</div>
                <div style="font-size: 0.875rem; color: #6b7280;">覆盖省份</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: #f3f4f6; border-radius: 0.5rem;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${geoData.cities.length}</div>
                <div style="font-size: 0.875rem; color: #6b7280;">覆盖城市</div>
            </div>
        </div>
        
        <div style="margin-top: 1.5rem;">
            <h4 style="margin-bottom: 1rem;">Top 10 城市分布</h4>
            <div style="display: grid; gap: 0.5rem;">
                ${geoData.cities.slice(0, 10).map((city, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f9fafb; border-radius: 0.25rem;">
                        <span>${index + 1}. ${city.city}</span>
                        <span style="font-weight: bold;">${city.count}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ==================== 设备数据 ====================
async function loadDeviceData() {
    try {
        const deviceData = await APIManager.get('/admin/device-stats');
        
        // 初始化操作系统和设备类型图表
        initOSChart(deviceData.data.operatingSystems);
        initDeviceTypeChart(deviceData.data.deviceTypes);
        
        // 显示设备统计
        renderDeviceStats(deviceData.data);
        
    } catch (error) {
        console.error('加载设备数据失败:', error);
    }
}

function initOSChart(osData) {
    const ctx = document.getElementById('osChart');
    if (!ctx || !osData) return;
    
    if (charts.os) {
        charts.os.destroy();
    }
    
    charts.os = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: osData.map(os => os.os),
            datasets: [{
                data: osData.map(os => os.count),
                backgroundColor: [
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444',
                    '#8b5cf6',
                    '#06b6d4'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function initDeviceTypeChart(deviceTypes) {
    const ctx = document.getElementById('deviceTypeChart');
    if (!ctx || !deviceTypes) return;
    
    if (charts.deviceType) {
        charts.deviceType.destroy();
    }
    
    charts.deviceType = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: deviceTypes.map(dt => dt.device_type),
            datasets: [{
                data: deviceTypes.map(dt => dt.count),
                backgroundColor: [
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function renderDeviceStats(deviceData) {
    const statsContainer = document.getElementById('deviceStats');
    const totalDevices = deviceData.deviceTypes.reduce((sum, dt) => sum + dt.count, 0);
    
    statsContainer.innerHTML = `
        <div style="display: grid; gap: 1rem;">
            <div>
                <h4>浏览器统计</h4>
                <div style="display: grid; gap: 0.5rem; margin-top: 0.5rem;">
                    ${deviceData.browsers.map(browser => `
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: #f9fafb; border-radius: 0.25rem;">
                            <span>${getBrowserIcon(browser.browser)} ${browser.browser}</span>
                            <span><strong>${browser.count}</strong> (${((browser.count / totalDevices) * 100).toFixed(1)}%)</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div>
                <h4>操作系统统计</h4>
                <div style="display: grid; gap: 0.5rem; margin-top: 0.5rem;">
                    ${deviceData.operatingSystems.map(os => `
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: #f9fafb; border-radius: 0.25rem;">
                            <span>${getOSIcon(os.os)} ${os.os}</span>
                            <span><strong>${os.count}</strong> (${((os.count / totalDevices) * 100).toFixed(1)}%)</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// ==================== 安全数据 ====================
async function loadSecurityData() {
    // 这里可以加载安全相关的数据
    console.log('加载安全监控数据...');
}

// ==================== 实时更新 ====================
function startRealTimeUpdates() {
    updateTimer = setInterval(async () => {
        try {
            if (currentTab === 'overview') {
                const realTimeData = await APIManager.get('/admin/real-time-data');
                updateStatsCards(realTimeData.data.stats);
                updateRecentActivity(realTimeData.data.recentLogins);
            }
            
            updateTimerDisplay();
        } catch (error) {
            console.error('实时更新失败:', error);
        }
    }, UPDATE_INTERVAL);
    
    // 开始倒计时显示
    startTimerCountdown();
}

function startTimerCountdown() {
    let countdown = UPDATE_INTERVAL / 1000;
    
    const countdownTimer = setInterval(() => {
        countdown--;
        document.getElementById('updateTimer').textContent = `自动更新: ${countdown}s`;
        
        if (countdown <= 0) {
            countdown = UPDATE_INTERVAL / 1000;
        }
    }, 1000);
}

function updateTimerDisplay() {
    // 重置倒计时
    startTimerCountdown();
}

// ==================== 工具函数 ====================
function formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
}

function formatRelativeTime(dateString) {
    if (!dateString) return '-';
    
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return formatDateTime(dateString);
}

function getDeviceIcon(deviceInfo) {
    if (!deviceInfo) return '🖥️';
    
    const info = typeof deviceInfo === 'string' ? deviceInfo : JSON.stringify(deviceInfo);
    
    if (info.includes('mobile') || info.includes('Mobile')) return '📱';
    if (info.includes('tablet') || info.includes('iPad')) return '📲';
    return '🖥️';
}

function getDeviceType(deviceInfo) {
    if (!deviceInfo) return '未知';
    
    const info = typeof deviceInfo === 'string' ? deviceInfo : JSON.stringify(deviceInfo);
    
    if (info.includes('mobile') || info.includes('Mobile')) return '移动设备';
    if (info.includes('tablet') || info.includes('iPad')) return '平板设备';
    return '桌面设备';
}

function getBrowserIcon(browser) {
    const icons = {
        'Chrome': '🌐',
        'Firefox': '🦊',
        'Safari': '🧭',
        'Edge': '🔷',
        'Opera': '🎭'
    };
    return icons[browser] || '🌐';
}

function getOSIcon(os) {
    const icons = {
        'Windows': '🪟',
        'macOS': '🍎',
        'Linux': '🐧',
        'Android': '🤖',
        'iOS': '📱'
    };
    return icons[os] || '💻';
}

// ==================== 事件绑定 ====================
function initEventListeners() {
    // Tab切换
    initTabs();
    
    // 搜索和筛选
    document.getElementById('searchBtn')?.addEventListener('click', () => {
        currentPage = 1;
        loadUsersData();
    });
    
    document.getElementById('userSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentPage = 1;
            loadUsersData();
        }
    });
    
    // 排序变化
    document.getElementById('sortBy')?.addEventListener('change', () => {
        currentPage = 1;
        loadUsersData();
    });
    
    document.getElementById('sortOrder')?.addEventListener('change', () => {
        currentPage = 1;
        loadUsersData();
    });
    
    // 分页
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadUsersData();
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
        currentPage++;
        loadUsersData();
    });
    
    // 模态框关闭
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('active');
        });
    });
    
    // 点击模态框背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // 积分表单提交
    document.getElementById('pointsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePointsSubmission();
    });
    
    // 刷新活动
    document.getElementById('refreshActivity')?.addEventListener('click', () => {
        loadOverviewData();
    });
    
    // 登出
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminToken');
        window.location.href = '/admin-login.html';
    });
}

// 积分修改处理
async function handlePointsSubmission() {
    try {
        const form = document.getElementById('pointsForm');
        const userId = form.dataset.userId;
        const action = document.getElementById('pointsAction').value;
        const points = parseInt(document.getElementById('pointsAmount').value);
        const reason = document.getElementById('pointsReason').value;
        
        await APIManager.put(`/admin/user/${userId}/points`, {
            action,
            points,
            reason
        });
        
        showToast('积分修改成功', 'success');
        document.getElementById('pointsModal').classList.remove('active');
        
        // 刷新用户列表
        if (currentTab === 'users') {
            loadUsersData();
        }
        
    } catch (error) {
        console.error('修改积分失败:', error);
        showToast('修改积分失败', 'error');
    }
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    // 检查认证
    if (!authToken) {
        // 尝试从URL参数获取token（用于管理员登录后跳转）
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        
        if (tokenFromUrl) {
            authToken = tokenFromUrl;
            localStorage.setItem('adminToken', authToken);
            // 清除URL中的token
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            // 重定向到管理员登录页面
            window.location.href = '/admin-login.html';
            return;
        }
    }
    
    try {
        showLoading();
        
        // 初始化事件监听
        initEventListeners();
        
        // 加载默认数据
        await loadOverviewData();
        
        // 开始实时更新
        startRealTimeUpdates();
        
        hideLoading();
        
        showToast('管理员控制台加载完成', 'success');
        
    } catch (error) {
        console.error('初始化失败:', error);
        hideLoading();
        showToast('初始化失败', 'error');
    }
});

// ==================== 全局函数 ====================
window.showUserDetail = showUserDetail;
window.editUserPoints = editUserPoints;
window.goToPage = goToPage;