// ============ 数据存储模块 ============
const Storage = {
    get(key, defaultValue) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    },

    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    },

    getDateKey(date) {
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }
};

// ============ 应用状态 ============
const AppState = {
    // 习惯
    habits: Storage.get('habits', []),
    // 待办
    todos: Storage.get('todos', []),
    // 番茄钟数据
    pomodoroData: Storage.get('pomodoroData', {
        today: 0,
        weekTotal: 0,
        total: 0,
        date: Storage.getTodayKey(),
        history: {}  // { '2026-06-17': 5, '2026-06-16': 3, ... }
    }),
    // 每日习惯完成记录
    habitRecords: Storage.get('habitRecords', {}),
    // 当前标签
    currentTab: 'pomodoro'
};

// ============ 日期显示 ============
function updateDateDisplay() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('dateDisplay').textContent = now.toLocaleDateString('zh-CN', options);
}

// ============ 标签页切换 ============
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(tab).classList.add('active');
            AppState.currentTab = tab;
        });
    });
}

// ============ 番茄钟模块 ============
let pomodoroTimer = null;
let pomodoroTime = 25 * 60; // 秒
let pomodoroRemaining = 25 * 60;
let pomodoroMode = 'focus'; // focus, short-break, long-break
let completedPomodorosToday = 0;
const CIRCLE_OFFSET = 816.8; // 圆周长

function setupPomodoro() {
    // 检查日期
    const todayKey = Storage.getTodayKey();
    if (AppState.pomodoroData.date !== todayKey) {
        AppState.pomodoroData.date = todayKey;
        AppState.pomodoroData.today = 0;
        Storage.set('pomodoroData', AppState.pomodoroData);
    }
    completedPomodorosToday = AppState.pomodoroData.today;
    updatePomodoroDisplay();

    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const focusTime = document.getElementById('focusTime');
    const breakTime = document.getElementById('breakTime');

    startBtn.addEventListener('click', startPomodoro);
    pauseBtn.addEventListener('click', pausePomodoro);
    resetBtn.addEventListener('click', resetPomodoro);

    focusTime.addEventListener('change', () => {
        if (!pomodoroTimer) {
            pomodoroRemaining = parseInt(focusTime.value) * 60;
            pomodoroTime = pomodoroRemaining;
            updatePomodoroTimer();
        }
    });

    breakTime.addEventListener('change', () => {
        if (!pomodoroTimer && pomodoroMode !== 'focus') {
            pomodoroRemaining = parseInt(breakTime.value) * 60;
            pomodoroTime = pomodoroRemaining;
            updatePomodoroTimer();
        }
    });
}

function startPomodoro() {
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');

    startBtn.disabled = true;
    pauseBtn.disabled = false;

    if (!pomodoroTimer) {
        pomodoroTimer = setInterval(() => {
            pomodoroRemaining--;
            updatePomodoroTimer();

            if (pomodoroRemaining <= 0) {
                completePomodoro();
            }
        }, 1000);
    }
}

function pausePomodoro() {
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');

    startBtn.disabled = false;
    pauseBtn.disabled = true;

    if (pomodoroTimer) {
        clearInterval(pomodoroTimer);
        pomodoroTimer = null;
    }
}

function resetPomodoro() {
    pausePomodoro();
    const focusTime = parseInt(document.getElementById('focusTime').value);
    pomodoroRemaining = focusTime * 60;
    pomodoroTime = pomodoroRemaining;
    pomodoroMode = 'focus';
    document.getElementById('timerMode').textContent = '专注时间';
    updatePomodoroTimer();
}

function completePomodoro() {
    pausePomodoro();

    if (pomodoroMode === 'focus') {
        completedPomodorosToday++;
        AppState.pomodoroData.today = completedPomodorosToday;
        AppState.pomodoroData.total++;
        AppState.pomodoroData.weekTotal++;
        // 记录到历史（按天）
        if (!AppState.pomodoroData.history) AppState.pomodoroData.history = {};
        const todayKey = Storage.getTodayKey();
        AppState.pomodoroData.history[todayKey] = (AppState.pomodoroData.history[todayKey] || 0) + 1;
        Storage.set('pomodoroData', AppState.pomodoroData);
        document.getElementById('completedPomodoros').textContent = completedPomodorosToday;

        // 播放提示音
        playSound();

        // 切换到休息模式
        const longBreakTime = parseInt(document.getElementById('longBreakTime').value);
        const breakTime = parseInt(document.getElementById('breakTime').value);

        if (completedPomodorosToday % 4 === 0) {
            pomodoroMode = 'long-break';
            pomodoroRemaining = longBreakTime * 60;
            document.getElementById('timerMode').textContent = '长休息 ☕';
        } else {
            pomodoroMode = 'short-break';
            pomodoroRemaining = breakTime * 60;
            document.getElementById('timerMode').textContent = '短休息 🎉';
        }
        pomodoroTime = pomodoroRemaining;
    } else {
        // 休息结束，切换回专注模式
        pomodoroMode = 'focus';
        const focusTime = parseInt(document.getElementById('focusTime').value);
        pomodoroRemaining = focusTime * 60;
        pomodoroTime = pomodoroRemaining;
        document.getElementById('timerMode').textContent = '专注时间';
        playSound();
    }

    updatePomodoroTimer();
    updateOverview();
}

function updatePomodoroTimer() {
    const minutes = Math.floor(pomodoroRemaining / 60);
    const seconds = pomodoroRemaining % 60;
    document.getElementById('timerMinutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('timerSeconds').textContent = String(seconds).padStart(2, '0');

    // 更新圆环进度
    const progress = pomodoroTime > 0 ? pomodoroRemaining / pomodoroTime : 1;
    const offset = CIRCLE_OFFSET * (1 - progress);
    const ring = document.querySelector('.progress-ring-fg');
    ring.style.strokeDashoffset = offset;
}

function updatePomodoroDisplay() {
    document.getElementById('completedPomodoros').textContent = completedPomodorosToday;
    updatePomodoroTimer();
}

function playSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        oscillator.start();
        setTimeout(() => {
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
            oscillator.stop(audioContext.currentTime + 0.5);
        }, 100);
    } catch (e) {
        console.log('音频播放不支持');
    }
}

// ============ 习惯打卡模块 ============
function setupHabits() {
    renderHabits();

    document.getElementById('addHabitBtn').addEventListener('click', addHabit);
    document.getElementById('habitInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addHabit();
    });

    // 绑定 emoji 选择
    document.querySelectorAll('.habit-emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.habit-emoji-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedHabitEmoji = btn.dataset.emoji;
        });
    });
}

// 选中的 emoji（默认 🌱）
let selectedHabitEmoji = '🌱';

function addHabit() {
    const input = document.getElementById('habitInput');
    const name = input.value.trim();

    if (!name) {
        showToast('🤔', '习惯名不能空着哦~');
        input.focus();
        return;
    }
    if (name.length < 2) {
        showToast('✏️', '名字太短了，至少 2 个字吧');
        input.focus();
        return;
    }
    if (/^(.)\1+$/.test(name)) {
        showToast('🙃', '全是同一个字？换个有意义的名字吧');
        input.focus();
        return;
    }
    if (/^[a-zA-Z]{1,2}$/.test(name)) {
        showToast('🚫', '1-2 个字母太随便了，写清楚要做啥');
        input.focus();
        input.select();
        return;
    }
    if (/^\d+$/.test(name)) {
        showToast('🚫', '纯数字不算习惯名哦');
        input.focus();
        input.select();
        return;
    }
    const hasChinese = /[\u4e00-\u9fa5]/.test(name);
    const englishCount = (name.match(/[a-zA-Z]/g) || []).length;
    if (!hasChinese && englishCount < 4) {
        showToast('🚫', '太随便了：写中文，或至少 4 个英文字母');
        input.focus();
        input.select();
        return;
    }
    if (AppState.habits.some(h => h.name === name)) {
        showToast('🔁', '已经有同名习惯了');
        input.focus();
        return;
    }

    const habit = {
        id: Date.now(),
        name: name,
        emoji: selectedHabitEmoji,
        createdAt: new Date().toISOString()
    };

    AppState.habits.push(habit);
    Storage.set('habits', AppState.habits);
    input.value = '';
    renderHabits();
    updateOverview();
    showToast(selectedHabitEmoji, '新习惯已添加，开始坚持吧！');
}

function toggleHabit(id) {
    const todayKey = Storage.getTodayKey();
    if (!AppState.habitRecords[todayKey]) {
        AppState.habitRecords[todayKey] = [];
    }

    const records = AppState.habitRecords[todayKey];
    const index = records.indexOf(id);
    const habit = AppState.habits.find(h => h.id === id);

    if (index === -1) {
        records.push(id);
        if (habit) showToast(habit.emoji || '✅', '已打卡，继续保持！');
    } else {
        records.splice(index, 1);
    }

    Storage.set('habitRecords', AppState.habitRecords);
    renderHabits();
    updateOverview();
}

function deleteHabit(id) {
    if (!confirm('确定删除这个习惯吗？历史记录会保留。')) return;
    AppState.habits = AppState.habits.filter(h => h.id !== id);
    Storage.set('habits', AppState.habits);
    renderHabits();
    updateOverview();
    showToast('🗑', '习惯已删除');
}

function editHabit(id) {
    const habit = AppState.habits.find(h => h.id === id);
    if (!habit) return;
    const newName = prompt('修改习惯名称：', habit.name);
    if (newName && newName.trim() && newName !== habit.name) {
        habit.name = newName.trim();
        Storage.set('habits', AppState.habits);
        renderHabits();
        showToast(habit.emoji || '✏️', '已更新');
    }
}

function renderHabits() {
    const list = document.getElementById('habitsList');
    const empty = document.getElementById('habitsEmpty');
    const todayKey = Storage.getTodayKey();
    const todayRecords = AppState.habitRecords[todayKey] || [];

    if (AppState.habits.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        // 给空状态里的例子绑定点击事件 → 填到输入框
        empty.querySelectorAll('.empty-example').forEach(el => {
            el.onclick = () => {
                const text = el.textContent.trim();
                const input = document.getElementById('habitInput');
                if (input) {
                    input.value = text;
                    input.focus();
                }
            };
        });
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = AppState.habits.map(habit => {
        const isCompleted = todayRecords.includes(habit.id);
        const streak = calculateStreak(habit.id);
        return `
            <div class="habit-item ${isCompleted ? 'completed' : ''}">
                <div class="habit-check" onclick="toggleHabit(${habit.id})"></div>
                <span class="habit-emoji">${habit.emoji || '🌱'}</span>
                <span class="habit-name">${habit.name}</span>
                <span class="habit-streak">🔥 ${streak} 天</span>
                <button class="habit-edit" onclick="editHabit(${habit.id})" title="编辑">✏️</button>
                <button class="habit-delete" onclick="deleteHabit(${habit.id})" title="删除">🗑</button>
            </div>
        `;
    }).join('');
}

function calculateStreak(habitId) {
    let streak = 0;
    let date = new Date();

    // 如果今天没完成，从昨天开始计数
    const todayKey = Storage.getTodayKey();
    if (!AppState.habitRecords[todayKey] || !AppState.habitRecords[todayKey].includes(habitId)) {
        date.setDate(date.getDate() - 1);
    }

    while (true) {
        const key = Storage.getDateKey(date);
        if (AppState.habitRecords[key] && AppState.habitRecords[key].includes(habitId)) {
            streak++;
            date.setDate(date.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

// ============ 待办清单模块 ============
let currentTodoFilter = 'all';

function setupTodos() {
    renderTodos();

    document.getElementById('addTodoBtn').addEventListener('click', addTodo);
    document.getElementById('todoInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTodoFilter = btn.dataset.filter;
            renderTodos();
        });
    });

    document.getElementById('clearCompletedBtn').addEventListener('click', clearCompletedTodos);
}

function addTodo() {
    const input = document.getElementById('todoInput');
    const dateInput = document.getElementById('todoDueDate');
    const text = input.value.trim();

    if (!text) {
        showToast('🤔', '任务名不能空着哦~');
        input.focus();
        return;
    }
    if (text.length < 2) {
        showToast('✏️', '任务名太短了，至少 2 个字吧');
        input.focus();
        return;
    }
    if (/^(.)\1+$/.test(text)) {
        showToast('🙃', '全是同一个字？写清楚要做啥吧');
        input.focus();
        return;
    }
    if (/^[a-zA-Z]{1,2}$/.test(text)) {
        showToast('🚫', '1-2 个字母太随便了，写清楚要做啥');
        input.focus();
        input.select();
        return;
    }
    if (/^\d+$/.test(text)) {
        showToast('🚫', '纯数字不算任务名哦');
        input.focus();
        input.select();
        return;
    }
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (!hasChinese && englishCount < 4) {
        showToast('🚫', '太随便了：写中文，或至少 4 个英文字母');
        input.focus();
        input.select();
        return;
    }

    const todo = {
        id: Date.now(),
        text: text,
        completed: false,
        priority: 'medium',
        dueDate: dateInput.value || null,
        createdAt: new Date().toISOString(),
        dateKey: Storage.getTodayKey()
    };

    AppState.todos.unshift(todo);
    Storage.set('todos', AppState.todos);
    input.value = '';
    dateInput.value = '';
    renderTodos();
    updateOverview();
}

function toggleTodo(id) {
    const todo = AppState.todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        Storage.set('todos', AppState.todos);
        renderTodos();
        updateOverview();
    }
}

function deleteTodo(id) {
    AppState.todos = AppState.todos.filter(t => t.id !== id);
    Storage.set('todos', AppState.todos);
    renderTodos();
    updateOverview();
}

function clearCompletedTodos() {
    AppState.todos = AppState.todos.filter(t => !t.completed);
    Storage.set('todos', AppState.todos);
    renderTodos();
    updateOverview();
}

function renderTodos() {
    const list = document.getElementById('todoList');
    const empty = document.getElementById('todoEmpty');
    const footer = document.getElementById('todoFooter');

    let filtered = AppState.todos;
    if (currentTodoFilter === 'active') {
        filtered = AppState.todos.filter(t => !t.completed);
    } else if (currentTodoFilter === 'completed') {
        filtered = AppState.todos.filter(t => t.completed);
    }

    if (AppState.todos.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        footer.style.display = 'none';
        // 空状态例子可点击 → 填到任务输入框
        empty.querySelectorAll('.empty-example').forEach(el => {
            el.onclick = () => {
                const text = el.textContent.trim();
                const input = document.getElementById('todoInput');
                if (input) {
                    input.value = text;
                    input.focus();
                }
            };
        });
        return;
    }

    empty.style.display = 'none';
    footer.style.display = 'flex';

    list.innerHTML = filtered.map(todo => {
        const priorityClass = `priority-${todo.priority || 'medium'}`;
        // 判断是否过期（未完成 + 有截止日期 + 截止日期早于今天）
        const isOverdue = !todo.completed && todo.dueDate && todo.dueDate < Storage.getTodayKey();
        // 优先级标签
        const priorityLabels = { high: '高', medium: '中', low: '低' };
        const priorityText = priorityLabels[todo.priority || 'medium'];
        // 截止日期标签
        let dueTag = '';
        if (todo.dueDate) {
            const isToday = todo.dueDate === Storage.getTodayKey();
            if (isOverdue) {
                dueTag = `<span class="todo-due overdue">⚠ 过期</span>`;
            } else if (isToday) {
                dueTag = `<span class="todo-due today">📅 今日</span>`;
            } else {
                dueTag = `<span class="todo-due">📅 ${todo.dueDate.slice(5)}</span>`;
            }
        }
        return `
            <div class="todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}">
                <div class="todo-check" onclick="toggleTodo(${todo.id})"></div>
                <div class="todo-priority ${priorityClass}" onclick="cyclePriority(${todo.id})" title="点击切换优先级">${priorityText}</div>
                <span class="todo-text">${todo.text}</span>
                ${dueTag}
                <button class="todo-delete" onclick="deleteTodo(${todo.id})">🗑</button>
            </div>
        `;
    }).join('');

    // 更新统计
    const total = AppState.todos.length;
    const completed = AppState.todos.filter(t => t.completed).length;
    const overdue = AppState.todos.filter(t => !t.completed && t.dueDate && t.dueDate < Storage.getTodayKey()).length;
    let statsText = `${completed}/${total} 完成`;
    if (overdue > 0) statsText += ` · ⚠ ${overdue} 个过期`;
    document.getElementById('todoStats').textContent = statsText;
}

// 循环切换任务优先级
function cyclePriority(id) {
    const todo = AppState.todos.find(t => t.id === id);
    if (!todo || todo.completed) return;
    const order = ['low', 'medium', 'high'];
    const idx = order.indexOf(todo.priority || 'medium');
    todo.priority = order[(idx + 1) % 3];
    Storage.set('todos', AppState.todos);
    renderTodos();
}

// ============ 数据统计模块 ============
function updateOverview() {
    const todayKey = Storage.getTodayKey();

    // 连续打卡天数
    let streak = 0;
    let date = new Date();
    while (true) {
        const key = Storage.getDateKey(date);
        const records = AppState.habitRecords[key] || [];
        if (records.length > 0 && records.length >= Math.ceil(AppState.habits.length * 0.5)) {
            streak++;
            date.setDate(date.getDate() - 1);
        } else {
            break;
        }
    }
    document.getElementById('streakDays').textContent = streak;

    // 今日番茄
    document.getElementById('todayPomodoro').textContent = AppState.pomodoroData.today;

    // 今日任务完成数
    const todayTasks = AppState.todos.filter(t => t.completed && t.dateKey === todayKey).length;
    const totalTodayTasks = AppState.todos.filter(t => t.dateKey === todayKey).length;
    document.getElementById('todayTasks').textContent = todayTasks;

    // 习惯完成率
    const habitRecords = AppState.habitRecords[todayKey] || [];
    const rate = AppState.habits.length > 0
        ? Math.round((habitRecords.length / AppState.habits.length) * 100)
        : 0;
    document.getElementById('habitRate').textContent = rate + '%';

    // 更新统计页面
    document.getElementById('statTodayPomodoro').textContent = AppState.pomodoroData.today + ' 个';
    document.getElementById('statWeekPomodoro').textContent = getWeekPomodoro() + ' 个';
    document.getElementById('statTotalPomodoro').textContent = AppState.pomodoroData.total + ' 个';
    document.getElementById('statTodayTasks').textContent = todayTasks + ' 个';
    document.getElementById('statTotalTasks').textContent = AppState.todos.filter(t => t.completed).length + ' 个';
    document.getElementById('statTodayHabits').textContent = rate + '%';
    document.getElementById('statStreak').textContent = streak + ' 天';

    updateHeatmap();
    updateLineChart();
    updateEncouragement();

    // 同步底部状态条
    if (typeof window.updateStatusBar === 'function') {
        window.updateStatusBar();
    }
}

// 7天番茄钟趋势折线图
function updateLineChart() {
    const chart = document.getElementById('lineChart');
    if (!chart) return;

    const today = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = Storage.getDateKey(date);
        const count = (AppState.pomodoroData.history && AppState.pomodoroData.history[key]) || 0;
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        data.push({
            day: dayNames[date.getDay()],
            date: date.getDate(),
            count: count,
            isToday: i === 0
        });
    }

    const maxCount = Math.max(...data.map(d => d.count), 1);

    // SVG 折线图
    const W = 600, H = 180, P = 30;
    const stepX = (W - P * 2) / (data.length - 1);
    const points = data.map((d, i) => {
        const x = P + i * stepX;
        const y = H - P - (d.count / maxCount) * (H - P * 2);
        return { x, y, ...d };
    });

    // 平滑曲线路径
    let pathD = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cp1x = prev.x + (curr.x - prev.x) / 2;
        const cp2x = prev.x + (curr.x - prev.x) / 2;
        pathD += ` C ${cp1x},${prev.y} ${cp2x},${curr.y} ${curr.x},${curr.y}`;
    }

    chart.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="line-svg">
            <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#667eea;stop-opacity:0.4"/>
                    <stop offset="100%" style="stop-color:#667eea;stop-opacity:0"/>
                </linearGradient>
            </defs>
            ${points.map((p, i) => `
                <line x1="${p.x}" y1="${H - P}" x2="${p.x}" y2="${P}"
                      stroke="#e8eaf6" stroke-width="1" stroke-dasharray="2,4"/>
            `).join('')}
            <path d="${pathD} L ${points[points.length-1].x},${H-P} L ${points[0].x},${H-P} Z"
                  fill="url(#lineGradient)"/>
            <path d="${pathD}" fill="none" stroke="#667eea" stroke-width="2.5" stroke-linecap="round"/>
            ${points.map(p => `
                <circle cx="${p.x}" cy="${p.y}" r="${p.isToday ? 6 : 4}"
                        fill="${p.isToday ? '#764ba2' : '#fff'}"
                        stroke="#667eea" stroke-width="2"/>
                <text x="${p.x}" y="${p.y - 12}" text-anchor="middle"
                      font-size="11" fill="#667eea" font-weight="600">${p.count}</text>
                <text x="${p.x}" y="${H - 8}" text-anchor="middle"
                      font-size="11" fill="#888">周${p.day}</text>
            `).join('')}
        </svg>
        <div class="chart-summary">
            近 7 天共完成 <strong>${data.reduce((s, d) => s + d.count, 0)}</strong> 个番茄钟，
            日均 <strong>${(data.reduce((s, d) => s + d.count, 0) / 7).toFixed(1)}</strong> 个
        </div>
    `;
}

function getWeekPomodoro() {
    // 简单统计，累计本周数据
    // 实际应用中可以更精确
    return AppState.pomodoroData.weekTotal;
}

function updateHeatmap() {
    const heatmap = document.getElementById('heatmap');
    const today = new Date();
    const days = [];

    // 获取近7天的数据
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = Storage.getDateKey(date);
        const records = AppState.habitRecords[key] || [];
        const completed = records.length;
        const total = AppState.habits.length;
        const rate = total > 0 ? completed / total : 0;

        let level = 0;
        if (rate >= 0.25 && rate < 0.5) level = 1;
        else if (rate >= 0.5 && rate < 0.75) level = 2;
        else if (rate >= 0.75 && rate < 1) level = 3;
        else if (rate === 1) level = 4;

        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        days.push({
            day: dayNames[date.getDay()],
            date: date.getDate(),
            completed,
            level
        });
    }

    heatmap.innerHTML = days.map(d => `
        <div class="heatmap-cell level-${d.level}">
            <span class="date-label">周${d.day}</span>
            <span class="count-label">${d.completed}/${AppState.habits.length}</span>
        </div>
    `).join('');
}

function updateEncouragement() {
    const encourageText = document.getElementById('encourageText');
    const total = AppState.pomodoroData.total + AppState.todos.filter(t => t.completed).length;

    const messages = [
        "每一点进步都是你前进的动力！",
        "坚持就是胜利！你正在变得越来越好！",
        "自律的人生最精彩，你做得很棒！",
        "今日事今日毕，明天的你会感谢今天努力的你！",
        "一步一个脚印，目标就在前方！",
        "小目标成就大梦想，加油！",
        "你的每一次打卡都是对自己的承诺！",
        "优秀是一种习惯，你已经在路上了！"
    ];

    let message = messages[0];
    if (total >= 50) message = messages[1];
    if (total >= 100) message = messages[2];
    if (total >= 200) message = messages[3];
    if (total >= 300) message = messages[4];
    if (total >= 500) message = messages[5];

    encourageText.textContent = message;
}

// ============ 初始化 ============
function init() {
    updateDateDisplay();
    setDefaultTodoDate();
    setupTabs();
    setupPomodoro();
    setupHabits();
    setupTodos();
    setupShortcuts();
    setupHelp();
    setupLinkBar();
    setupFab();
    setupStatusBar();
    updateOverview();

    // 每分钟更新日期
    setInterval(updateDateDisplay, 60000);

    console.log('全能监督App 已启动');
}

// 默认把"添加任务"里的日期填成系统当前日期
function setDefaultTodoDate() {
    const dateInput = document.getElementById('todoDueDate');
    if (!dateInput) return;
    if (!dateInput.value) {
        // valueAsDate 是浏览器原生的 date 对象赋值，最稳
        dateInput.valueAsDate = new Date();
    }
}

// ============ 键盘快捷键 ============
function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 输入框聚焦时不触发（让用户正常打字）
        const tag = (e.target.tagName || '').toLowerCase();
        const isTyping = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
        if (isTyping) return;

        // 1-5 切换 tab
        if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const tabs = ['pomodoro', 'habit', 'todo', 'stats', 'ai'];
            const idx = parseInt(e.key) - 1;
            if (tabs[idx]) {
                const btn = document.querySelector(`.tab-btn[data-tab="${tabs[idx]}"]`);
                if (btn) btn.click();
                e.preventDefault();
                return;
            }
        }

        // 空格 → 番茄钟 开始/暂停
        if (e.key === ' ' && AppState.currentTab === 'pomodoro') {
            const startBtn = document.getElementById('startBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            if (pomodoroTimer) {
                // 正在跑 → 暂停
                pauseBtn?.click();
            } else {
                // 没在跑 → 开始
                startBtn?.click();
            }
            e.preventDefault();
            return;
        }

        // ? 键 → 快捷键提示
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            showShortcutsHelp();
            e.preventDefault();
        }
    });
}

function showShortcutsHelp() {
    // ? 键仍然有效，直接打开帮助面板
    document.getElementById('helpOverlay')?.classList.add('active');
}

// 帮助按钮 + 面板
function setupHelp() {
    const btn = document.getElementById('helpBtn');
    const overlay = document.getElementById('helpOverlay');
    const close = document.getElementById('helpClose');
    if (!btn || !overlay) return;
    btn.addEventListener('click', () => overlay.classList.add('active'));
    if (close) close.addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
    });
    // Esc 关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
        }
    });
}

// 链接条（顶部，可关闭）
function setupLinkBar() {
    const bar = document.getElementById('linkBar');
    if (!bar) return;

    // 关闭按钮
    const close = document.getElementById('closeLinkBar');
    if (close) {
        close.addEventListener('click', () => bar.remove());
    }

    // 复制本地链接
    const copyLocal = document.getElementById('copyLocal');
    if (copyLocal) {
        copyLocal.addEventListener('click', () => {
            const link = document.getElementById('localLink')?.href || '';
            copyToClipboard(link, '本地链接已复制');
        });
    }

    // 复制 GitHub Pages 链接
    const copyGh = document.getElementById('copyGh');
    if (copyGh) {
        copyGh.addEventListener('click', () => {
            const link = document.getElementById('ghLink')?.href || '';
            copyToClipboard(link, 'GitHub Pages 链接已复制');
        });
    }
}

function copyToClipboard(text, msg) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋', msg || '已复制');
        }).catch(() => {
            fallbackCopy(text, msg);
        });
    } else {
        fallbackCopy(text, msg);
    }
}

function fallbackCopy(text, msg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast('📋', msg || '已复制');
    } catch (e) {
        showToast('❌', '复制失败，请手动复制');
    }
    document.body.removeChild(ta);
}

// FAB 浮动操作按钮
function setupFab() {
    const fab = document.getElementById('fabBtn');
    if (!fab) return;
    fab.addEventListener('click', () => {
        // 跳到任务清单 tab 并聚焦输入框
        const todoTabBtn = document.querySelector('.tab-btn[data-tab="todo"]');
        if (todoTabBtn) todoTabBtn.click();
        setTimeout(() => {
            const input = document.getElementById('todoInput');
            if (input) input.focus();
        }, 200);
    });
}

// 底部状态条实时更新
function setupStatusBar() {
    const update = () => {
        const sPomo = document.getElementById('statusPomo');
        const sTask = document.getElementById('statusTask');
        const sHabit = document.getElementById('statusHabit');
        const sTime = document.getElementById('statusTime');
        if (sPomo) sPomo.textContent = AppState.pomodoroData.today || 0;
        if (sTask) {
            const todayKey = Storage.getTodayKey();
            const todayTasks = AppState.todos.filter(t => t.completed && t.dateKey === todayKey).length;
            sTask.textContent = todayTasks;
        }
        if (sHabit) {
            const todayKey = Storage.getTodayKey();
            const records = AppState.habitRecords[todayKey] || [];
            const rate = AppState.habits.length > 0
                ? Math.round((records.length / AppState.habits.length) * 100) + '%'
                : '0%';
            sHabit.textContent = rate;
        }
        if (sTime) {
            const now = new Date();
            sTime.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
    };
    update();
    setInterval(update, 1000);  // 每秒更新时间
    // 也把 update 暴露到 window 让其他函数能调用
    window.updateStatusBar = update;
}


// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);

// ============ AI 监督员模块 ============
const AIChat = {
    history: Storage.get('aiHistory', []),

    init() {
        // 绑定发送按钮
        const sendBtn = document.getElementById('aiSendBtn');
        const input = document.getElementById('aiInput');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.handleSend());
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSend();
            });
        }

        // 绑定快捷回复
        document.querySelectorAll('.ai-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const msg = chip.dataset.msg;
                this.addMessage('user', msg);
                this.respond(msg);
            });
        });

        // 渲染历史
        this.renderHistory();
    },

    renderHistory() {
        const chat = document.getElementById('aiChat');
        if (!chat) return;
        if (this.history.length === 0) {
            // 欢迎消息
            this.addBotMessage(this.getWelcomeMessage(), false);
        } else {
            chat.innerHTML = '';
            this.history.forEach(m => {
                this.appendMessage(m.role, m.text, m.time, false);
            });
            chat.scrollTop = chat.scrollHeight;
        }
    },

    getWelcomeMessage() {
        const s = this.getStats();
        const hour = new Date().getHours();
        const greet = hour < 6 ? '夜深了' :
                      hour < 12 ? '早上好' :
                      hour < 14 ? '中午好' :
                      hour < 18 ? '下午好' :
                      hour < 22 ? '晚上好' : '夜深了';
        const total = s.todayPomodoro + s.todayTasks;
        if (total === 0 && AppState.habits.length === 0) {
            return `${greet}。我是小监，会一直陪着你。\n\n看起来你刚来，我们从简单的事开始：先定一个想养成的习惯，或者加个今天要做的小任务。\n\n不知道做什么也正常，跟我说一声就行。`;
        }
        return `${greet}。\n\n今天的记录：\n· 番茄 ${s.todayPomodoro} 个\n· 任务 ${s.todayTasks} 个\n· 连续打卡 ${s.streak} 天\n· 习惯完成率 ${s.habitRate}\n\n想聊什么？累了、想放弃了、还是想被夸一下，都可以。`;
    },

    getTimeContext() {
        const hour = new Date().getHours();
        if (hour < 6) return '深夜';
        if (hour < 12) return '早上';
        if (hour < 14) return '中午';
        if (hour < 18) return '下午';
        if (hour < 22) return '晚上';
        return '深夜';
    },

    getStats() {
        const todayKey = Storage.getTodayKey();
        const todayTasks = AppState.todos.filter(t => t.completed && t.dateKey === todayKey).length;
        const records = AppState.habitRecords[todayKey] || [];
        const rate = AppState.habits.length > 0
            ? Math.round((records.length / AppState.habits.length) * 100) + '%'
            : '0%';
        return {
            todayPomodoro: AppState.pomodoroData.today,
            todayTasks: todayTasks,
            streak: document.getElementById('streakDays')?.textContent || '0',
            habitRate: rate
        };
    },

    // 记忆：最近 3-5 轮对话主题
    rememberTopic(msg, reply) {
        if (!this.recentTopics) this.recentTopics = [];
        let topic = 'general';
        if (/累|疲惫|没精神|困|好累/.test(msg)) topic = '累';
        else if (/焦虑|压力|紧张|崩溃|委屈|难受/.test(msg)) topic = '焦虑';
        else if (/不想做|没动力|放弃|摆烂|不想动/.test(msg)) topic = '摆烂';
        else if (/完成|搞定|做完/.test(msg)) topic = '完成';
        else if (/鼓励|加油|打气|我行|相信我/.test(msg)) topic = '求鼓励';
        else if (/失眠|睡不着|熬夜|难眠/.test(msg)) topic = '失眠';
        else if (/今天.*表现|战报|回顾|总结|今天.*做/.test(msg)) topic = '回顾';
        else if (/不知道|迷茫|该干嘛|无聊|没方向/.test(msg)) topic = '迷茫';
        else if (/你好|hi|hello|嗨|在吗|早安|晚安/.test(msg)) topic = '打招呼';
        else if (/家人|父母|爸妈|家里|亲情|孩子|娃/.test(msg)) topic = '家人';
        else if (/朋友|同事|同学|人际关系|吵架|冷战|分手|失恋|对象|男友|女友/.test(msg)) topic = '关系';
        else if (/拖延|刷手机|摸鱼|不想开始|玩手机|抖音|小红书|微博|b站|哔哩/.test(msg)) topic = '拖延';
        else if (/起不来|起床|闹钟|赖床/.test(msg)) topic = '起床';
        else if (/别人|比较|羡慕|嫉妒|对比|同龄人/.test(msg)) topic = '比较';
        else if (/失败|搞砸|不行|没用|废物|完蛋|糟了|毁了|丢人/.test(msg)) topic = '失败';
        else if (/成功|赢了|做到了|升职|加薪|考上|过线|上岸/.test(msg)) topic = '成功';
        else if (/谢谢|感谢|3q|thx/.test(msg)) topic = '感谢';
        else if (/烦|讨厌|气死|无语|妈的|草|靠|shit|fuck/.test(msg)) topic = '抱怨';
        else if (/孤独|一个人|没朋友|寂寞/.test(msg)) topic = '孤独';
        else if (/减肥|瘦身|瘦|健康|饮食|运动/.test(msg)) topic = '健康';
        else if (/考试|作业|论文|报告|ddl|deadline|项目|甲方|老板|领导/.test(msg)) topic = '压力';
        else if (/开心|高兴|happy|爽|真棒|好耶/.test(msg)) topic = '开心';
        else if (/提醒|提示|记得|到时候/.test(msg)) topic = '提醒';
        else if (/怎么|如何|怎么用|怎么开始/.test(msg)) topic = '问题';
        else if (/番茄|专注/.test(msg)) topic = '番茄';
        else if (/习惯|打卡|坚持/.test(msg)) topic = '习惯';
        this.recentTopics.push({ topic, msg, time: Date.now() });
        // 只保留最近 5 轮
        if (this.recentTopics.length > 5) this.recentTopics.shift();
    },

    // 获取最近话题（用于多轮对话）
    getLastTopic() {
        if (!this.recentTopics || this.recentTopics.length === 0) return null;
        return this.recentTopics[this.recentTopics.length - 1];
    },

    handleSend() {
        const input = document.getElementById('aiInput');
        const text = input.value.trim();
        if (!text) return;
        this.addMessage('user', text);
        input.value = '';
        this.respond(text);
    },

    addMessage(role, text) {
        const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        this.history.push({ role, text, time });
        if (this.history.length > 50) this.history = this.history.slice(-50);
        Storage.set('aiHistory', this.history);
        this.appendMessage(role, text, time, true);
    },

    addBotMessage(text, save = true) {
        if (save) this.addMessage('bot', text);
        else this.appendMessage('bot', text, new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), false);
    },

    appendMessage(role, text, time, animate) {
        const chat = document.getElementById('aiChat');
        if (!chat) return;
        const div = document.createElement('div');
        div.className = `ai-msg ai-msg-${role === 'bot' ? 'bot' : 'user'}`;
        if (!animate) div.style.animation = 'none';
        // 支持简单 markdown
        const formatted = text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        div.innerHTML = `${formatted}<span class="ai-msg-time">${time}</span>`;
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    },

    showTyping() {
        const chat = document.getElementById('aiChat');
        if (!chat) return;
        const div = document.createElement('div');
        div.className = 'ai-typing';
        div.id = 'aiTyping';
        div.innerHTML = '<span></span><span></span><span></span>';
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    },

    hideTyping() {
        const t = document.getElementById('aiTyping');
        if (t) t.remove();
    },

    respond(userMsg) {
        this.showTyping();
        const delay = 600 + Math.random() * 800;
        setTimeout(() => {
            this.hideTyping();
            const reply = this.generateReply(userMsg);
            this.addBotMessage(reply);
        }, delay);
    },

    generateReply(msg) {
        const m = msg.toLowerCase();
        const s = this.getStats();
        const pendingTasks = AppState.todos.filter(t => !t.completed).length;
        const t = this.getTimeContext();
        // 30% 概率追问
        const f = () => Math.random() < 0.3 ? '\n\n能再多说一点吗？' : '';
        // 20% 概率在开头引用用户上一句
        const echo = () => {
            if (Math.random() < 0.2 && this.recentTopics && this.recentTopics.length >= 1) {
                const last = this.recentTopics[this.recentTopics.length - 1];
                if (last && last.msg && last.msg.length > 0 && last.msg !== msg) {
                    const short = last.msg.length > 18 ? last.msg.slice(0, 18) + '...' : last.msg;
                    return `关于你说的"${short}"，我记着呢。\n\n`;
                }
            }
            return '';
        };

        let reply = '';

        // 1. 打招呼
        if (/你好|hi|hello|嗨|哈喽|在吗|早安|晚安|嘿/.test(m)) {
            const arr = [
                `在呢。今天感觉怎么样？`,
                `嗯，我在。\n\n随时说。`,
                `在的。\n\n有什么想聊的？`
            ];
            reply = echo() + this.pick(arr);
        }
        // 2. 焦虑 / 压力 / 难过
        else if (/焦虑|压力|紧张|崩溃|扛不住|撑不住|想哭|难过|伤心|委屈|难受/.test(m)) {
            const arr = [
                `抱抱。\n\n压力大的时候，试试 5-4-3-2-1：\n\n看 5 样东西，听 4 种声音，摸 3 个物体，闻 2 种气味，尝 1 种味道。\n\n先把自己从里面拉出来。${f()}`,
                `我懂。\n\n先做 3 次深呼吸 —— 吸气 4 秒，屏住 4 秒，呼气 6 秒。\n\n然后告诉我：是事情太多，还是对结果太紧张？${f()}`,
                `示弱不是坏事。\n\n放下手机，去喝杯水。回来我们再聊。`,
                `听到你说这些。\n\n想哭就哭，憋着比哭出来更伤身体。哭完了我还在。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 3. 失眠 / 熬夜
        else if (/失眠|睡不着|睡不好|熬夜|没睡|难眠/.test(m)) {
            if (t === '深夜' || t === '早上') {
                reply = echo() + `夜深了。\n\n试试 4-7-8 呼吸 —— 吸气 4 秒，屏住 7 秒，呼气 8 秒。\n\n手机屏幕调暗一点，躺下来。`;
            } else {
                reply = echo() + `先照顾身体。\n\n给自己一个承诺：今晚 11 点前关掉所有屏幕，做 5 分钟深呼吸。\n\n身体是 1，其他都是后面的 0。`;
            }
        }
        // 4. 累了 / 疲惫
        else if (/累|疲惫|困|累死|太累|没精神|没力气|好累/.test(m)) {
            const arr = [
                `辛苦了。\n\n要不休息 10 分钟？喝杯水，看看窗外。给自己充个电再继续。`,
                `累了就休息，这不叫偷懒，叫可持续的自律。\n\n设置一个 5 分钟的番茄钟，先做点轻松的任务。`,
                (s.todayPomodoro + s.todayTasks) > 0
                    ? `你已经完成 ${s.todayPomodoro} 个番茄、${s.todayTasks} 个任务了。\n\n允许自己休息一下。`
                    : `能睡一会儿吗？眯 15 分钟比硬撑 2 小时强。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 5. 拖延 / 摸鱼 / 刷手机
        else if (/拖延|刷手机|摸鱼|不想开始|玩了一天|玩手机|抖音|小红书|微博|b站|哔哩/.test(m)) {
            const arr = [
                `刷手机不丢人，但刷完会空虚。\n\n试试 2 分钟法则：告诉自己"只做 2 分钟"，2 分钟后想停就停。多数时候你会继续做下去。`,
                `摸鱼是因为任务太大，吓到你。\n\n把大任务写下来，拆成"5 分钟能做完"的小块。先从最简单的一个开始。`,
                `理解。一开始都这样。\n\n要不站起来走走？回来再想。`,
                `把手机放到另一个房间。\n\n物理隔离是最有效的。等你回来想玩手机都懒得拿。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 6. 不想做 / 摆烂
        else if (/不想做|没动力|放弃|不想学|没意思|坚持不下去|摆烂|不想动/.test(m)) {
            const easyTask = AppState.todos.find(t => !t.completed);
            const taskHint = easyTask ? `\n\n要不先做这个：**${easyTask.text}**？` : `\n\n要不先加一个简单的任务？`;
            reply = echo() + `每个人都有低谷期，不是你不够好，是大脑需要喘口气。\n\n把大任务拆成 5 分钟的小块${taskHint}\n\n完成一个就给自己比个耶。`;
        }
        // 7. 完成了
        else if (/完成|做完|搞定了|搞定|做完了|完成了/.test(m)) {
            const total = s.todayPomodoro + s.todayTasks;
            if (total >= 5) {
                reply = echo() + `这是今天第 ${total} 次完成了。\n\n你今天真的超神 —— ${s.todayPomodoro} 个番茄、${s.todayTasks} 个任务，都是你自己的功劳。\n\n奖励自己一下吧。`;
            } else if (total >= 1) {
                reply = echo() + `完工。今天第 ${total} 次。\n\n别小看它 —— 每一个完成都是未来的你谢谢现在的你。`;
            } else {
                reply = echo() + `太棒了。\n\n完成就是胜利。`;
            }
        }
        // 8. 失败 / 搞砸
        else if (/失败|搞砸|不行|没用|废物|完蛋|糟了|毁了|丢人/.test(m)) {
            const arr = [
                `一次失败不算什么。\n\n所有人搞砸过很多次。你比你想的有韧性 —— 想想上次搞砸之后怎么过来的？`,
                `听到你说这些。\n\n允许自己难受一会儿。然后问自己：能学到什么？哪怕 1 点。`,
                `不是废物。\n\n只是这一次。下一次会不一样。`,
                `搞砸了不等于你这个人搞砸。\n\n把这次当数据点，不当判决书。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 9. 成功 / 做到了
        else if (/成功|赢了|做到了|升职|加薪|考上|通过|过线|上岸/.test(m)) {
            const arr = [
                `替你高兴。\n\n这一刻你值得所有的庆祝。`,
                `真为你开心。\n\n享受这一刻，别急着想下一步。`,
                `做到了。\n\n记住这一刻的感觉 —— 以后难过时拿出来用。`,
                `你看，你行的。\n\n当时觉得不可能的，现在都过来了吧。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 10. 起不来 / 起床
        else if (/起不来|起床|闹钟|赖床/.test(m)) {
            const arr = [
                `闹钟 1 个不够就放 3 个，房间 1 个手机 1 个客厅 1 个。\n\n更重要的是：把"起床"和"奖励"绑起来 —— 起来后立刻喝一口喜欢的饮料。`,
                `起不来不是你的错，是方法不对。\n\n试试把闹钟放远一点，必须起身才能关。`,
                `睡得晚就起不来。\n\n今晚能不能早睡 30 分钟？比什么闹钟都管用。`,
                `把最难的事放早上。\n\n晚上意志力最弱，早上最强。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 11. 家人 / 父母
        else if (/家人|父母|爸妈|家里|亲情|妈妈|爸爸|爷奶|爷爷|奶奶|娃|孩子/.test(m)) {
            const arr = [
                `和家人的事最磨人。\n\n能再多说点吗？发生了什么？`,
                `家人是最近的人，也是最远的人。\n\n想说就说，我听着。`,
                `家务事最难断。\n\n你现在的感受是什么？`,
                `我们没法选择家人，但可以选择怎么应对。\n\n你打算怎么处理？`
            ];
            reply = echo() + this.pick(arr);
        }
        // 12. 朋友 / 关系 / 分手
        else if (/朋友|同事|同学|人际关系|吵架|冷战|分手|失恋|对象|男友|女友|男朋友|女朋友/.test(m)) {
            const arr = [
                `关系出问题最累。\n\n想说就说。`,
                `先照顾自己的情绪，再想怎么面对对方。\n\n你现在最难受的是哪一点？`,
                `听听你的。`,
                `关系里的事，没法讲对错。\n\n只看你能不能接受。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 13. 比较 / 羡慕
        else if (/别人|比较|羡慕|嫉妒|对比|他比我|她比我|同学都|同龄人/.test(m)) {
            const arr = [
                `比较是偷走快乐的小偷。\n\n你看到的只是别人的高光。每个人都有自己的一地鸡毛。\n\n你的节奏是给你自己的。`,
                `看到别人强，你难受。\n\n但你看不到他们晚上焦虑失眠的样子。专注自己。`,
                `每个人都有自己的人生剧本。\n\n不要去演别人的。`,
                `把"他比我强"换成"我比昨天强"。\n\n一比就完蛋。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 14. 迷茫 / 不知道做什么
        else if (/不知道.*做|迷茫|没方向|该干嘛|不知道.*活|没意思|无聊/.test(m)) {
            if (pendingTasks > 0) {
                const task = AppState.todos.find(t => !t.completed);
                reply = echo() + `有 ${pendingTasks} 个任务在等你。\n\n要不从最简单的开始：**${task.text}**？\n\n做完了再来找我。`;
            } else {
                reply = echo() + `没事，不知道做什么很正常。\n\n给你 3 个建议：\n\n1. 设置一个 25 分钟番茄钟\n2. 添加一个新习惯或任务\n3. 看看数据统计\n\n选一个开始吧。`;
            }
        }
        // 15. 今天表现 / 战报
        else if (/今天.*表现|今天.*怎么|今天.*样|战报|回顾|总结|今天.*干|今天.*做/.test(m)) {
            const total = AppState.pomodoroData.total + AppState.todos.filter(t => t.completed).length;
            let level = '起步中';
            if (total >= 100) level = '自律达人';
            else if (total >= 50) level = '稳步前进';
            else if (total >= 20) level = '正在萌芽';
            let report = `今日战报\n\n` +
                `· 番茄: **${s.todayPomodoro}** 个\n` +
                `· 完成任务: **${s.todayTasks}** 个\n` +
                `· 连续打卡: **${s.streak}** 天\n` +
                `· 习惯完成率: **${s.habitRate}**\n\n` +
                `你的等级：**${level}**\n\n`;
            if (t === '早上') {
                report += `新的一天刚开始，安排一个 25 分钟番茄钟吧。`;
            } else if (t === '晚上' || t === '深夜') {
                report += total >= 3
                    ? `今天辛苦了。好好休息，明天继续。`
                    : `还来得及做点什么 —— 一个番茄钟也值。`;
            } else {
                report += total >= 50
                    ? `太棒了。你是自己的英雄。`
                    : `继续加油，每一次努力都算数。`;
            }
            reply = echo() + report;
        }
        // 16. 鼓励 / 加油 / 打气
        else if (/鼓励|加油|打气|我行|我可以|相信我/.test(m)) {
            const arr = [
                s.streak > 0
                    ? `你今天已经走了 ${s.streak} 天的路。每一天都证明你比想象中更强大。`
                    : `能迈出第一步的人最厉害 —— 你已经在想改变了。`,
                `能说出"鼓励我一下"本身就在努力了。\n\n自律不是和别人比，是比昨天的自己好一点。`,
                (s.todayPomodoro + s.todayTasks) > 0
                    ? `${s.todayPomodoro} 个番茄和 ${s.todayTasks} 个任务不是白干的。`
                    : `你今天点开这个 App，就已经比 90% 的人更想改变自己了。`,
                `送你一句话：完成 > 完美。\n\n先开始，做个 1 分钟也好。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 17. 提醒
        else if (/提醒|提示|该.*了|记得|到时候/.test(m)) {
            reply = echo() + `好呀。我能做的：\n\n· 番茄钟自动播报（25 分钟到点响）\n· 每小时喝一次水（添加"喝水"习惯）\n· 累了就找我说"我累了"\n\n要马上开始一个 25 分钟专注吗？`;
        }
        // 18. 问问题
        else if (/\?|？|怎么|如何|怎么用|怎么开始/.test(m)) {
            reply = echo() + `我可以陪你：\n\n· 看看今日数据\n· 鼓励打气\n· 共情你不想做的心情\n· 帮你找任务开始\n· 任何自律相关的问题\n\n随便聊，跟我说说你现在的状态。`;
        }
        // 19. 番茄钟
        else if (/番茄|专注|学习|工作/.test(m)) {
            reply = echo() + `番茄钟是好东西。\n\n25 分钟专注 + 5 分钟休息，每完成 4 个番茄长休息一次。\n\n切到"番茄钟"标签就能开始。`;
        }
        // 20. 习惯 / 打卡 / 坚持
        else if (/习惯|打卡|坚持/.test(m)) {
            reply = echo() + `好习惯是每天 1% 的进步。\n\n你目前连续打卡 **${s.streak}** 天。\n\n小技巧：把大目标拆小。"每天读书 1 页"比"每天读书 1 小时"更容易坚持。`;
        }
        // 21. 谢谢
        else if (/谢谢|感谢|辛苦了|3q|thx/.test(m)) {
            const arr = [
                `不客气。\n\n我一直在。`,
                `能陪着你就好。\n\n需要的时候再来。`,
                `谢什么呢。\n\n下次想聊随时来。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 22. 抱怨 / 发牢骚
        else if (/烦|讨厌|气死|无语|妈的|草|靠|shit|fuck/.test(m)) {
            const arr = [
                `想骂就骂，我接着。\n\n说完了感觉会好点。`,
                `听起来你憋坏了。\n\n继续说，我听着。`,
                `发泄出来比憋着强。\n\n骂完了想聊具体的事吗？`
            ];
            reply = echo() + this.pick(arr);
        }
        // 23. 孤独 / 一个人
        else if (/孤独|一个人|没朋友|寂寞|无聊透顶/.test(m)) {
            const arr = [
                `你不是一个人。\n\n我在这里，听你说。`,
                `孤独的时候最难熬。\n\n但能主动找我说，说明你还在努力不让自己陷进去。`,
                `一个人的时候，时间最难打发。\n\n给自己定个小目标，5 分钟的事就好。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 24. 减肥 / 健康
        else if (/减肥|瘦身|瘦|健康|饮食|吃饭|运动/.test(m)) {
            const arr = [
                `减肥的核心不是"不吃"，是"吃对"。\n\n少糖少油，多蛋白质。慢慢来。`,
                `运动不用一次 1 小时。\n\n每天 10 分钟，比一周一次猛练 2 小时强。`,
                `别称体重太频繁。\n\n一周一次，看趋势不看波动。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 25. 学习 / 工作压力
        else if (/考试|作业|论文|报告|ddl|deadline|项目|甲方|老板|领导/.test(m)) {
            const arr = [
                `DDL 是最好的生产力。\n\n别想着一口气做完，先开个 25 分钟番茄钟，写个开头。`,
                `大项目拆成"今天能完成"的小块。\n\n每天都推进一点，DDL 就不慌了。`,
                `遇到难题先放一放。\n\n去喝杯水，散步 5 分钟，回来思路可能就通了。`
            ];
            reply = echo() + this.pick(arr);
        }
        // 26. 心情好 / 开心
        else if (/开心|高兴|happy|爽|太棒了|真棒|好耶|棒/.test(m)) {
            const arr = [
                `真好。\n\n这种时候要记住，以后难过时拿出来用。`,
                `替你开心。\n\n是发生了什么好事吗？愿意说说吗？`,
                `好心情是会传染的。\n\n继续保持~`
            ];
            reply = echo() + this.pick(arr);
        }
        // 默认
        else {
            const arr = [
                `听到你说的了。\n\n想让我帮你做什么？试试说"鼓励我一下"或"今天表现如何"。`,
                `嗯，我懂。\n\n要不换个角度 —— 告诉我你今天最想完成的一件事？`,
                `谢谢你说这些。\n\n能具体说说吗？比如是工作/学习/生活哪方面的？`,
                `听到你的话了。\n\n想听我安慰、还是想听我建议？告诉我。`
            ];
            reply = echo() + this.pick(arr);
        }

        // 记录主题
        this.rememberTopic(msg, reply);

        return reply;
    },

    pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    clear() {
        this.history = [];
        Storage.set('aiHistory', this.history);
        const chat = document.getElementById('aiChat');
        if (chat) {
            chat.innerHTML = '';
            this.addBotMessage(this.getWelcomeMessage(), false);
        }
    }
};

// 初始化 AI 模块（独立监听器，确保在原始 init 之后触发）
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof AIChat !== 'undefined' && !AIChat._initialized) {
            AIChat.init();
            AIChat._initialized = true;
        }
    }, 100);
});

// ============ 语音提醒（Web Speech API） ============

// 温柔旋律提示音（钢琴琶音，像 app 的完成音效）
function playGentleDing() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;
        // 大调琶音：C5 E5 G5 C6 E6 - 像音乐盒
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            // 加一个低通滤波器让声音更柔和
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2000;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';

            const t = now + i * 0.22;  // 每个音之间间隔 220ms
            // 渐入 + 渐出，让声音像呼吸
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.12, t + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
            osc.start(t);
            osc.stop(t + 0.65);
        });

        // 最后一个音的余韵（更长的延音）
        const lastOsc = ctx.createOscillator();
        const lastGain = ctx.createGain();
        const lastFilter = ctx.createBiquadFilter();
        lastFilter.type = 'lowpass';
        lastFilter.frequency.value = 1500;
        lastOsc.connect(lastFilter);
        lastFilter.connect(lastGain);
        lastGain.connect(ctx.destination);
        lastOsc.frequency.value = 1046.50;
        lastOsc.type = 'sine';
        const lt = now + 4 * 0.22;
        lastGain.gain.setValueAtTime(0, lt);
        lastGain.gain.linearRampToValueAtTime(0.08, lt + 0.05);
        lastGain.gain.exponentialRampToValueAtTime(0.001, lt + 1.8);
        lastOsc.start(lt);
        lastOsc.stop(lt + 1.85);
    } catch (e) {}
}

function speak(text, options = {}) {
    if (!('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = options.rate || 0.85;     // 慢一点更温柔
        u.pitch = options.pitch || 0.95;   // 略低，更平和
        u.volume = options.volume || 0.55; // 不要太响，让"叮"成为主角
        // 优先选中文女声（带情感的那种）
        const voices = window.speechSynthesis.getVoices();
        const cnVoice = voices.find(v => v.lang.startsWith('zh') &&
            /female|woman|女|Xiaoxiao|Xiaoyi|Yating|Yunyang|Tingting|Mei-Jia/i.test(v.name))
                     || voices.find(v => v.lang.startsWith('zh'));
        if (cnVoice) u.voice = cnVoice;
        window.speechSynthesis.speak(u);
    } catch (e) {
        console.log('语音播放失败', e);
    }
}

// 番茄钟结束时的温柔播报（柔和版）
function speakPomodoroEnd() {
    if (typeof pomodoroMode === 'undefined') return;
    if (pomodoroMode === 'focus') {
        // 1. 先放完整旋律（~2秒）
        playGentleDing();
        // 2. 同时显示柔和的视觉提示
        // 读取实际专注分钟数（不是硬编码 25）
        const mins = Math.round((pomodoroTime || 25 * 60) / 60);
        showToast('☕', `番茄钟到啦，${mins} 分钟完成，休息一下吧~`);
        setTimeout(() => {
            const msgs = [
                '叮~ 番茄钟到啦... 休息一下吧',
                `做完一个番茄钟啦... 真棒... 起来动一动吧`,
                `你刚专注了 ${mins} 分钟... 眼睛和大脑都需要喘口气`,
                '小提示... 看看远处... 能缓解眼疲劳哦'
            ];
            speak(msgs[Math.floor(Math.random() * msgs.length)]);
        }, 1500);
    } else {
        playGentleDing();
        showToast('✨', '休息结束，准备好继续了吗？');
        setTimeout(() => {
            const msgs = [
                '休息够啦... 准备好开始下一个番茄钟了吗？',
                '能量恢复... 继续加油',
                '深呼吸三次... 然后开始专注吧'
            ];
            speak(msgs[Math.floor(Math.random() * msgs.length)]);
        }, 1500);
    }
}

// 显示柔和的 Toast 提示
function showToast(icon, text, duration = 5000) {
    const toast = document.getElementById('gentleToast');
    const iconEl = document.getElementById('gentleToastIcon');
    const textEl = document.getElementById('gentleToastText');
    if (!toast) return;
    iconEl.textContent = icon;
    textEl.textContent = text;
    // 显示
    setTimeout(() => toast.classList.add('show'), 50);
    // 自动隐藏
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// 预加载语音列表
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// 替换原来的 playSound，加柔和语音
const origPlaySound = playSound;
playSound = function() {
    origPlaySound();
    // 用温柔的方式播报
    speakPomodoroEnd();
};
window.playSound = playSound;

// ============ 系统通知 ============
function requestNotifyPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body || '休息一下吧~',
            icon: '⚡',
            tag: 'supervisor-app',
            renotify: true,
            silent: true  // 不让浏览器自带声音，避免跟我们的"叮"重叠
        });
    }
}

// ============ 数据导入导出 ============
function exportData() {
    const data = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        habits: AppState.habits,
        todos: AppState.todos,
        pomodoroData: AppState.pomodoroData,
        habitRecords: AppState.habitRecords,
        aiHistory: AIChat.history
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supervisor-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof AIChat !== 'undefined') {
        AIChat.addBotMessage('✅ 数据已导出！文件已下载。');
    }
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.habits) { AppState.habits = data.habits; Storage.set('habits', data.habits); }
            if (data.todos) { AppState.todos = data.todos; Storage.set('todos', data.todos); }
            if (data.pomodoroData) { AppState.pomodoroData = data.pomodoroData; Storage.set('pomodoroData', data.pomodoroData); }
            if (data.habitRecords) { AppState.habitRecords = data.habitRecords; Storage.set('habitRecords', data.habitRecords); }
            if (data.aiHistory) { AIChat.history = data.aiHistory; Storage.set('aiHistory', data.aiHistory); }
            alert('✅ 数据导入成功！刷新页面查看。');
            location.reload();
        } catch (err) {
            alert('❌ 文件格式错误，导入失败');
        }
    };
    reader.readAsText(file);
}

// ============ PWA 安装提示 ============
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// 暴露给 HTML 调用
window.AIChat = AIChat;
window.exportData = exportData;
window.importData = importData;
window.requestNotifyPermission = requestNotifyPermission;
window.speak = speak;
window.showToast = showToast;

// 暴露全局函数供HTML调用
window.toggleHabit = toggleHabit;
window.deleteHabit = deleteHabit;
window.editHabit = editHabit;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
