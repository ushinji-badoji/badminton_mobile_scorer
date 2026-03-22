let state = {
    ruleMax: 21, ruleSets: 3, deuceLimit: 30, midPoint: 11,
    isDoubles: false,
    scoreA: 0, scoreB: 0, setsA: 0, setsB: 0,
    currentSet: 1, serverSide: 'A',
    isEndSwapped: false, midPointReached: false,
    isGameOver: false,
    initialSetup: { serverTeam: 'A', serverIdx: 0, receiverIdx: 0 },
    court: { A: { right: 0, left: 1 }, B: { right: 0, left: 1 } },
    history: []
};

let undoStack = []; // 一つ戻る機能のための履歴保存用配列

function setMatchType(type) {
    state.isDoubles = (type === 'doubles');
    document.getElementById('btnSingles').className = !state.isDoubles ? 'active' : '';
    document.getElementById('btnDoubles').className = state.isDoubles ? 'active' : '';
    document.body.className = state.isDoubles ? 'mode-doubles' : 'mode-singles';
    initGame();
}

function initGame() {
    const rule = document.getElementById('gameRule').value.split('-');
    state.ruleMax = parseInt(rule[0]); state.ruleSets = parseInt(rule[1]);
    state.deuceLimit = (state.ruleMax === 21) ? 30 : 21;
    state.midPoint = (state.ruleMax === 21) ? 11 : 8;
    state.scoreA = 0; state.scoreB = 0; state.setsA = 0; state.setsB = 0;
    state.currentSet = 1; state.isEndSwapped = false; state.midPointReached = false; 
    state.isGameOver = false; state.history = [];
    
    state.initialSetup = { serverTeam: 'A', serverIdx: 0, receiverIdx: 0 };
    state.court = { A: { right: 0, left: 1 }, B: { right: 0, left: 1 } };
    state.serverSide = 'A';
    
    undoStack = []; // 履歴もリセット
    updateUI();
}

function manualSwapEnds() { state.isEndSwapped = !state.isEndSwapped; updateUI(); }

function getTeamDisplayName(team) {
    const p1 = document.getElementById(`p_${team}_0`).value;
    const p2 = document.getElementById(`p_${team}_1`).value;
    return state.isDoubles ? `${p1}/${p2}` : p1;
}

// 初期サーバー・レシーバーの設定 (0-0のときのみ操作可能)
function setRole(team, idx) {
    if (state.scoreA > 0 || state.scoreB > 0) return; // 試合開始後は変更不可
    
    if (team === state.initialSetup.serverTeam) {
        state.initialSetup.serverIdx = idx;
        state.court[team].right = idx;
        state.court[team].left = 1 - idx;
    } else {
        if (state.initialSetup.receiverIdx === idx) {
            // 現在のRをクリックした場合は、サーブ権を相手チームに渡す
            state.initialSetup.serverTeam = team;
            state.initialSetup.serverIdx = idx;
            state.initialSetup.receiverIdx = state.court[team === 'A' ? 'B' : 'A'].right;
            state.serverSide = team;
        } else {
            // レシーバーの変更
            state.initialSetup.receiverIdx = idx;
            state.court[team].right = idx;
            state.court[team].left = 1 - idx;
        }
    }
    updateUI();
}

function getPlayerRole(team, idx) {
    if (!state.isDoubles) {
        return (team === state.initialSetup.serverTeam) ? 'S' : 'R';
    }
    if (team === state.initialSetup.serverTeam) {
        return (idx === state.initialSetup.serverIdx) ? 'S' : '3';
    } else {
        return (idx === state.initialSetup.receiverIdx) ? 'R' : '2';
    }
}

function getCurrentServer() {
    const team = state.serverSide;
    const score = (team === 'A') ? state.scoreA : state.scoreB;
    const courtSide = (score % 2 === 0) ? 'right' : 'left';
    return { team: team, idx: state.court[team][courtSide] };
}

// 状態を保存する関数
function saveState() {
    undoStack.push(JSON.stringify(state));
}

// 一つ戻る機能の関数
function undoPoint() {
    if (undoStack.length === 0) {
        alert("これ以上戻れません。");
        return;
    }
    state = JSON.parse(undoStack.pop());
    updateUI();
}

function addPoint(team) {
    if (state.isGameOver) return;
    
    saveState(); // 点数が入る直前の状態を保存

    const currentServer = getCurrentServer();
    const serverName = document.getElementById(`p_${currentServer.team}_${currentServer.idx}`).value;

    if (team === state.serverSide) {
        // サーブ側が得点：得点したチームのみ左右の立ち位置を交代
        if (state.isDoubles) {
            let temp = state.court[team].right;
            state.court[team].right = state.court[team].left;
            state.court[team].left = temp;
        }
    } else {
        // レシーブ側が得点：サーブ権が移る（立ち位置は交代しない）
        state.serverSide = team;
    }

    if (team === 'A') state.scoreA++;
    else state.scoreB++;

    state.history.push({
        set: state.currentSet, score: `${state.scoreA}-${state.scoreB}`,
        scoringTeam: getTeamDisplayName(team), server: serverName, reason: 'ラリー'
    });

    checkAutoRules(); updateUI();
}

function checkAutoRules() {
    const isWin = (s, o) => (s >= state.ruleMax && s - o >= 2) || s === state.deuceLimit;
    
    if (isWin(state.scoreA, state.scoreB)) { state.setsA++; finishSet(); }
    else if (isWin(state.scoreB, state.scoreA)) { state.setsB++; finishSet(); }

    const isFinalSet = (state.currentSet === state.ruleSets || (state.ruleSets === 3 && (state.setsA === 1 && state.setsB === 1)));
    if (isFinalSet && !state.midPointReached) {
        if (state.scoreA === state.midPoint || state.scoreB === state.midPoint) {
            alert(`${state.midPoint}点：インターバル。エンドを交代してください。`);
            state.isEndSwapped = !state.isEndSwapped;
            state.midPointReached = true;
        }
    }
}

function finishSet() {
    const winThreshold = state.ruleSets === 1 ? 1 : 2;
    if (state.setsA >= winThreshold || state.setsB >= winThreshold) {
        state.isGameOver = true;
        updateUI();
        setTimeout(() => alert("試合終了！CSVを保存してください。"), 100);
    } else {
        alert(`第${state.currentSet}ゲーム終了。エンドを交代して次へ進みます。`);
        
        // 勝ったサイドが次のゲームで最初にサービスをする
        const winner = state.scoreA > state.scoreB ? 'A' : 'B';
        state.serverSide = winner;
        state.initialSetup.serverTeam = winner;
        state.initialSetup.serverIdx = 0;
        state.initialSetup.receiverIdx = 0;
        state.court.A = { right: 0, left: 1 };
        state.court.B = { right: 0, left: 1 };

        state.currentSet++; state.scoreA = 0; state.scoreB = 0;
        state.midPointReached = false; state.isEndSwapped = !state.isEndSwapped;
    }
}

function getRoleClass(role) {
    if (role === 'S') return 'role-s';
    if (role === 'R') return 'role-r';
    if (role === '2') return 'role-2';
    if (role === '3') return 'role-3';
    return '';
}

function updateUI() {
    document.getElementById('scoreA').innerText = state.scoreA;
    document.getElementById('scoreB').innerText = state.scoreB;
    document.getElementById('gameCount').innerText = `第 ${state.currentSet} ゲーム` + (state.isGameOver ? " (終了)" : "");
    
    document.getElementById('matchLayout').classList.toggle('swapped', state.isEndSwapped);
    document.getElementById('cardA').classList.toggle('serving', state.serverSide === 'A');
    document.getElementById('cardB').classList.toggle('serving', state.serverSide === 'B');

    renderDots('setDotsA', state.setsA); renderDots('setDotsB', state.setsB);

    // 役割ボタン（S, R, 2, 3）の更新
    ['A', 'B'].forEach(team => {
        for (let i = 0; i < 2; i++) {
            const role = getPlayerRole(team, i);
            const btn = document.getElementById(`role_${team}_${i}`);
            btn.innerText = role;
            btn.className = 'role-btn ' + getRoleClass(role);
        }
    });

    const nameA0 = document.getElementById('p_A_0').value;
    const nameA1 = document.getElementById('p_A_1').value;
    const nameB0 = document.getElementById('p_B_0').value;
    const nameB1 = document.getElementById('p_B_1').value;

    if (state.isDoubles) {
        document.getElementById('posA').innerText = `右: ${state.court.A.right === 0 ? nameA0 : nameA1} | 左: ${state.court.A.left === 0 ? nameA0 : nameA1}`;
        document.getElementById('posB').innerText = `右: ${state.court.B.right === 0 ? nameB0 : nameB1} | 左: ${state.court.B.left === 0 ? nameB0 : nameB1}`;
    } else {
        const courtSideA = state.serverSide === 'A' ? (state.scoreA % 2 === 0 ? '右' : '左') : 'レシーブ待機';
        const courtSideB = state.serverSide === 'B' ? (state.scoreB % 2 === 0 ? '右' : '左') : 'レシーブ待機';
        document.getElementById('posA').innerText = `位置: ${courtSideA}`;
        document.getElementById('posB').innerText = `位置: ${courtSideB}`;
    }
    renderLog();
}

function renderDots(id, count) {
    let html = ''; const total = state.ruleSets > 1 ? 2 : 1;
    for (let i = 0; i < total; i++) html += `<div class="dot ${i < count ? 'filled' : ''}"></div>`;
    document.getElementById(id).innerHTML = html;
}

function setReason(r) {
    if (state.history.length > 0) { state.history[state.history.length - 1].reason = r; renderLog(); }
}

function renderLog() {
    document.getElementById('historyLog').innerHTML = state.history.slice().reverse().map(h => 
        `<li>G${h.set} [${h.score}] <b>${h.scoringTeam}</b> 得点 <br><small>(Srv: ${h.server} / ${h.reason})</small></li>`
    ).join('');
}

function confirmReset() { if (confirm("全てのスコアをリセットしますか？")) initGame(); }

function downloadCSV() {
    if (state.history.length === 0) return;
    let csv = "\uFEFFGame,Score,ScoringTeam,Server,Reason\n";
    state.history.forEach(h => { csv += `${h.set},${h.score},${h.scoringTeam},${h.server},${h.reason}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `badminton_log_${new Date().getTime()}.csv`;
    link.click();
}

window.onload = () => setMatchType('singles');
