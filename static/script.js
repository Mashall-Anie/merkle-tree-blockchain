let currentTree = null;
let currentProof = null;
let currentProofIndex = null;
let currentDataList = [];
let currentTreeLevels = [];

const MAX_LINES = 200;

function updateLineCounter() {
    const input = document.getElementById('dataInput').value;
    const lines = input.split('\n').filter(line => line.trim()).length;
    const lineCountEl = document.getElementById('lineCount');
    const counterEl = document.getElementById('lineCounter');
    const buildBtn = document.getElementById('buildBtn');

    lineCountEl.textContent = lines;

    counterEl.classList.remove('warning', 'error');

    if (lines > MAX_LINES) {
        counterEl.classList.add('error');
        buildBtn.disabled = true;
    }
    else if (lines > MAX_LINES * 0.9) {
        counterEl.classList.add('warning');
        buildBtn.disabled = false;
    }
    else {
        buildBtn.disabled = false;
    }
}

async function buildTree() {
    const input = document.getElementById('dataInput').value.trim();
    if (!input) {
        showStatus('buildStatus', 'Vui lòng nhập dữ liệu!', 'error');
        return;
    }

    const data = input.split('\n').map(line => line.trim()).filter(line => line);
    if (data.length === 0) {
        showStatus('buildStatus', 'Dữ liệu không hợp lệ!', 'error');
        return;
    }

    if (data.length > MAX_LINES) {
        showStatus('buildStatus', `Vượt quá giới hạn! Tối đa ${MAX_LINES} dòng (hiện tại: ${data.length})`, 'error');
        return;
    }

    try {
        showStatus('buildStatus', 'Đang xây dựng tree...', 'info');

        const response = await fetch('/api/build-tree', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: data })
        });

        const result = await response.json();

        if (!result.success) {
            showStatus('buildStatus', `Lỗi: ${result.error}`, 'error');
            return;
        }

        currentTree = result;
        currentDataList = result.data_list || [];
        currentTreeLevels = result.tree_levels || [];

        document.getElementById('rootHashDisplay').textContent = result.root_hash;
        document.getElementById('treeStructure').textContent = result.tree_structure;

        // Render visual tree
        renderVisualTree(result.tree_levels);

        // Populate dropdowns
        populateDataSelects();

        showStatus('buildStatus', `Xây dựng thành công! ${result.leaf_count} phần tử, ${result.depth} levels`, 'success');
    } catch (error) {
        showStatus('buildStatus', `Lỗi: ${error.message}`, 'error');
    }
}

function renderVisualTree(treeLevels, highlightConfig = null) {
    const container = document.getElementById('treeVisual');

    if (!treeLevels || treeLevels.length === 0) {
        container.innerHTML = '<div class="tree-placeholder">Chưa xây dựng tree</div>';
        return;
    }

    let html = '';

    treeLevels.forEach((level, levelIndex) => {
        html += `<div class="tree-level"><span class="tree-level-label">${level.level_name}</span><div class="tree-nodes">`;
        level.nodes.forEach(node => {
            let nodeClass = 'node-internal';
            if (node.is_root) nodeClass = 'node-root';
            else if (node.is_leaf) nodeClass = 'node-leaf';

            // Apply highlighting if config provided
            if (highlightConfig) {
                const nodeKey = `${level.level}-${node.index}`;
                if (highlightConfig.target === nodeKey)
                    nodeClass += ' node-target';
                else if (highlightConfig.proofNodes && highlightConfig.proofNodes.includes(nodeKey))
                    nodeClass += ' node-proof';
                else if (highlightConfig.computedNodes && highlightConfig.computedNodes.includes(nodeKey))
                    nodeClass += ' node-computed';
                else
                    nodeClass += ' node-dimmed';
            }

            const label = node.label ? node.label : '';
            const indexLabel = node.is_leaf ? `[${node.index}]` : '';

            html += `
                <div class="tree-node">
                    <div class="tree-node-box ${nodeClass}" title="${node.hash}">
                        ${node.hash_short}
                    </div>
                    ${label ? `<div class="tree-node-label" title="${label}">${label}</div>` : ''}
                    ${indexLabel ? `<div class="tree-node-index">${indexLabel}</div>` : ''}
                </div>
            `;
        });

        html += `</div></div>`;

        // Add connector lines between levels (except after leaf level)
        if (levelIndex < treeLevels.length - 1) {
            html += `<div class="tree-connectors">`;
            for (let i = 0; i < level.nodes.length; i++) {
                html += `<div class="tree-connector-line" style="margin: 0 ${50 + (levelIndex * 20)}px;"></div>`;
            }
            html += `</div>`;
        }
    });

    container.innerHTML = html;
}

/**
 * Render proof tree visualization
 * @param {Array} treeLevels - Array of tree levels
 * @param {number} proofIndex - Index of the proof
 * @param {Array} proof - Proof array
 */
function renderProofTree(treeLevels, proofIndex, proof) {
    const container = document.getElementById('proofTreeVisual');

    if (!treeLevels || treeLevels.length === 0) {
        container.innerHTML = '<div class="tree-placeholder">Không có dữ liệu</div>';
        return;
    }

    const highlightConfig = {
        target: `0-${proofIndex}`,  // Target leaf node
        proofNodes: [],              // Sibling nodes used in proof
        computedNodes: []            // Nodes computed from hash combination
    };

    let currentIndex = proofIndex;
    for (let levelIdx = 0; levelIdx < proof.length; levelIdx++) {
        const step = proof[levelIdx];
        const siblingIndex = step.position === 'right' ? currentIndex + 1 : currentIndex - 1;
        highlightConfig.proofNodes.push(`${levelIdx}-${siblingIndex}`);
        const parentIndex = Math.floor(currentIndex / 2);
        highlightConfig.computedNodes.push(`${levelIdx + 1}-${parentIndex}`);
        currentIndex = parentIndex;
    }

    // Render tree with highlighting
    let html = '';

    treeLevels.forEach((level, levelIndex) => {
        html += `<div class="tree-level"><span class="tree-level-label">${level.level_name}</span><div class="tree-nodes">`;

        level.nodes.forEach(node => {
            let nodeClass = 'node-internal';
            if (node.is_root) nodeClass = 'node-root';
            else if (node.is_leaf) nodeClass = 'node-leaf';

            const nodeKey = `${level.level}-${node.index}`;
            if (highlightConfig.target === nodeKey)
                nodeClass = 'node-target';
            else if (highlightConfig.proofNodes.includes(nodeKey))
                nodeClass = 'node-proof';
            else if (highlightConfig.computedNodes.includes(nodeKey))
                nodeClass = 'node-computed';
            else
                nodeClass += ' node-dimmed';

            const label = node.label ? node.label : '';
            const indexLabel = node.is_leaf ? `[${node.index}]` : '';

            html += `
                <div class="tree-node">
                    <div class="tree-node-box ${nodeClass}" title="${node.hash}">
                        ${node.hash_short}
                    </div>
                    ${label ? `<div class="tree-node-label" title="${label}">${label}</div>` : ''}
                    ${indexLabel ? `<div class="tree-node-index">${indexLabel}</div>` : ''}
                </div>
            `;
        });

        html += `</div></div>`;

        // Add connector lines between levels
        if (levelIndex < treeLevels.length - 1) {
            html += `<div class="tree-connectors">`;
            for (let i = 0; i < level.nodes.length; i++) {
                html += `<div class="tree-connector-line" style="margin: 0 ${50 + (levelIndex * 20)}px;"></div>`;
            }
            html += `</div>`;
        }
    });

    container.innerHTML = html;
}

function populateDataSelects() {
    const proofSelect = document.getElementById('proofSelect');
    const verifySelect = document.getElementById('verifySelect');

    // Clear existing options
    proofSelect.innerHTML = '';
    verifySelect.innerHTML = '';

    if (currentDataList.length === 0) {
        proofSelect.innerHTML = '<option value="" disabled selected>-- Vui lòng xây dựng tree trước --</option>';
        verifySelect.innerHTML = '<option value="" disabled selected>-- Chọn từ danh sách --</option>';
        return;
    }

    // Populate proof select
    proofSelect.innerHTML = '<option value="" disabled selected>-- Chọn phần tử --</option>';
    currentDataList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.index;
        option.textContent = `[${item.index}] ${item.data}`;
        proofSelect.appendChild(option);
    });

    // Populate verify select
    verifySelect.innerHTML = '<option value="" disabled selected>-- Chọn từ danh sách --</option>';
    currentDataList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.data;
        option.textContent = `[${item.index}] ${item.data}`;
        verifySelect.appendChild(option);
    });
}

function toggleTextStructure() {
    const structureEl = document.getElementById('treeStructure');
    if (structureEl.style.display === 'none')
        structureEl.style.display = 'block';
    else
        structureEl.style.display = 'none';
}

async function generateProof() {
    if (!currentTree) {
        showStatus('proofStatus', 'Vui lòng xây dựng tree trước!', 'error');
        return;
    }

    const proofSelect = document.getElementById('proofSelect');
    const selectedIndex = proofSelect.value;

    if (selectedIndex === '' || selectedIndex === null) {
        showStatus('proofStatus', 'Vui lòng chọn phần tử cần chứng minh!', 'error');
        return;
    }

    const index = parseInt(selectedIndex);
    if (isNaN(index) || index < 0 || index >= currentTree.leaf_count) {
        showStatus('proofStatus', `Chỉ số không hợp lệ! (0 - ${currentTree.leaf_count - 1})`, 'error');
        return;
    }

    try {
        const response = await fetch('/api/generate-proof', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ index: index })
        });

        const result = await response.json();

        if (!result.success) {
            showStatus('proofStatus', `Lỗi: ${result.error}`, 'error');
            return;
        }

        currentProof = result.proof;
        currentProofIndex = result.index;

        // Auto-fill verify input with the leaf data
        document.getElementById('verifyInput').value = result.leaf_data;
        document.getElementById('verifySelect').value = result.leaf_data;
        hideSearchResults();

        // Render proof tree visualization
        renderProofTree(currentTreeLevels, index, result.proof);
        document.getElementById('proofOutput').style.display = 'block';

        showStatus('proofStatus', `Sinh proof thành công! ${result.proof_steps} bước`, 'success');
    } catch (error) {
        showStatus('proofStatus', `Lỗi: ${error.message}`, 'error');
    }
}

// Verify input handling
function onVerifySelectChange() {
    const verifySelect = document.getElementById('verifySelect');
    const verifyInput = document.getElementById('verifyInput');

    if (verifySelect.value) {
        verifyInput.value = verifySelect.value;
        hideSearchResults();
    }
}

function onVerifyInputChange() {
    const verifyInput = document.getElementById('verifyInput');
    const verifySelect = document.getElementById('verifySelect');
    const query = verifyInput.value.trim().toLowerCase();

    // Clear select when typing in input
    verifySelect.selectedIndex = 0;

    if (query.length === 0) {
        hideSearchResults();
        return;
    }

    // Search for matching items
    const matches = currentDataList.filter(item =>
        item.data.toLowerCase().includes(query)
    );

    showSearchResults(matches, query);
}

function showSearchResults(matches, query) {
    const resultsContainer = document.getElementById('verifySearchResults');

    if (matches.length === 0) {
        resultsContainer.innerHTML = `
            <div class="verify-search-no-results">
                Không tìm thấy trong danh sách.<br>
                Nhấn "Kiểm Tra Proof" để kiểm tra với dữ liệu đã nhập.
            </div>
        `;
        resultsContainer.style.display = 'block';
        return;
    }

    let html = '';
    matches.slice(0, 10).forEach(item => {
        // Highlight matching portion
        const lowerData = item.data.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const matchIndex = lowerData.indexOf(lowerQuery);

        let displayText = item.data;
        if (matchIndex >= 0) {
            const before = item.data.substring(0, matchIndex);
            const match = item.data.substring(matchIndex, matchIndex + query.length);
            const after = item.data.substring(matchIndex + query.length);
            displayText = `${before}<span class="match-highlight">${match}</span>${after}`;
        }

        html += `
            <div class="verify-search-item" onclick="selectSearchResult('${escapeHtml(item.data)}')">
                [${item.index}] ${displayText}
            </div>
        `;
    });

    if (matches.length > 10) {
        html += `<div class="verify-search-no-results">...và ${matches.length - 10} kết quả khác</div>`;
    }

    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
}

function hideSearchResults() {
    document.getElementById('verifySearchResults').style.display = 'none';
}

function selectSearchResult(value) {
    document.getElementById('verifyInput').value = value;

    // Also update select if the value exists
    const verifySelect = document.getElementById('verifySelect');
    for (let i = 0; i < verifySelect.options.length; i++) {
        if (verifySelect.options[i].value === value) {
            verifySelect.selectedIndex = i;
            break;
        }
    }

    hideSearchResults();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\'");
}

function getVerifyData() {
    // Priority: text input, then select
    const verifyInput = document.getElementById('verifyInput');
    const verifySelect = document.getElementById('verifySelect');

    if (verifyInput.value.trim()) {
        return verifyInput.value.trim();
    }

    if (verifySelect.value && verifySelect.selectedIndex > 0) {
        return verifySelect.value;
    }

    return null;
}

async function verifyProof() {
    if (!currentTree || !currentProof) {
        showStatus('verifyStatus', 'Vui lòng sinh proof trước!', 'error');
        return;
    }

    const verifyData = getVerifyData();

    if (!verifyData) {
        showStatus('verifyStatus', 'Vui lòng chọn hoặc nhập dữ liệu cần kiểm tra!', 'error');
        return;
    }

    try {
        const response = await fetch('/api/verify-proof', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                leaf_data: verifyData,
                proof: currentProof
            })
        });

        const result = await response.json();
        if (!result.success) {
            showStatus('verifyStatus', `Lỗi: ${result.error}`, 'error');
            return;
        }

        // Render verification calculation visualization
        renderVerifyCalculation(result);
        document.getElementById('verifyResult').style.display = 'block';
    }
    catch (error) {
        showStatus('verifyStatus', `Lỗi: ${error.message}`, 'error');
    }
}

/**
 * Render step-by-step verification calculation visualization
 * @param {Object} verifyResult - Result from verify-proof API
 */
function renderVerifyCalculation(verifyResult) {
    const container = document.getElementById('verifyCalculation');

    if (!verifyResult || !verifyResult.computation_steps) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    const steps = verifyResult.computation_steps;

    steps.forEach(step => {
        if (step.type === 'leaf')
            html += `
                <div class="calc-step">
                    <span class="calc-step-number step-start">${step.step}</span>
                    <span class="calc-label">Leaf Hash:</span>
                    <span class="calc-function">SHA256("${step.input}")</span>
                </div>
                <div class="calc-step" style="padding-left: 36px;">
                    <span class="calc-arrow">→</span>
                    <span class="calc-hash-box hash-current">${step.result_short}</span>
                </div>
            `;
        else
            if (step.position === 'right')
                html += `
                    <div class="calc-step">
                        <span class="calc-step-number">${step.step}</span>
                        <span class="calc-label">Level ${step.level}:</span>
                        <span class="calc-hash-box hash-sibling">${step.left_hash}</span>
                        <span class="calc-operator">+</span>
                        <span class="calc-hash-box hash-current">${step.right_hash}</span>
                        <span class="calc-position">sibling: trái</span>
                    </div>
                    <div class="calc-step" style="padding-left: 36px;">
                        <span class="calc-function">SHA256(left + right)</span>
                        <span class="calc-arrow">→</span>
                        <span class="calc-hash-box hash-result">${step.result_short}</span>
                    </div>
                `;
            else
                html += `
                    <div class="calc-step">
                        <span class="calc-step-number">${step.step}</span>
                        <span class="calc-label">Level ${step.level}:</span>
                        <span class="calc-hash-box hash-current">${step.left_hash}</span>
                        <span class="calc-operator">+</span>
                        <span class="calc-hash-box hash-sibling">${step.right_hash}</span>
                        <span class="calc-position">sibling: phải</span>
                    </div>
                    <div class="calc-step" style="padding-left: 36px;">
                        <span class="calc-function">SHA256(left + right)</span>
                        <span class="calc-arrow">→</span>
                        <span class="calc-hash-box hash-result">${step.result_short}</span>
                    </div>
                `;
    });

    // Final comparison
    html += `<div class="calc-divider"></div>`;

    if (verifyResult.is_valid) {
        html += `
            <div class="calc-final-result result-match">
                <span class="calc-result-icon">✅</span>
                <div>
                    <div class="calc-result-text">Kết quả tính toán KHỚP với Root Hash!</div>
                    <div style="font-size: 11px; margin-top: 8px;">
                        <div><strong>Computed:</strong> <code>${verifyResult.computed_hash_short}</code></div>
                        <div><strong>Root Hash:</strong> <code>${verifyResult.root_hash_short}</code></div>
                    </div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="calc-final-result result-mismatch">
                <span class="calc-result-icon">❌</span>
                <div>
                    <div class="calc-result-text">Kết quả tính toán KHÔNG KHỚP với Root Hash!</div>
                    <div style="font-size: 11px; margin-top: 8px;">
                        <div><strong>Computed:</strong> <code style="color: #c62828;">${verifyResult.computed_hash_short}</code></div>
                        <div><strong>Root Hash:</strong> <code style="color: #2e7d32;">${verifyResult.root_hash_short}</code></div>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * Show status message
 * @param {string} elementId - ID of the element to show status
 * @param {string} message - Status message
 * @param {string} type - Status type (success, error, info)
 */
function showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="status ${type} show">${message}</div>`;
}

function clearAll() {
    document.getElementById('dataInput').value = '';
    clearProof();
    document.getElementById('buildStatus').innerHTML = '';
    document.getElementById('rootHashDisplay').textContent = 'Chưa xây dựng tree';
    document.getElementById('treeStructure').textContent = 'Chưa xây dựng tree';
    document.getElementById('treeVisual').innerHTML = '<div class="tree-placeholder">Chưa xây dựng tree</div>';

    currentTree = null;
    currentDataList = [];
    currentTreeLevels = [];

    // Reset dropdowns
    document.getElementById('proofSelect').innerHTML = '<option value="" disabled selected>-- Vui lòng xây dựng tree trước --</option>';
    document.getElementById('verifySelect').innerHTML = '<option value="" disabled selected>-- Chọn từ danh sách --</option>';
    document.getElementById('verifyInput').value = '';
    hideSearchResults();

    // Reset line counter
    updateLineCounter();
}

function clearProof() {
    currentProof = null;
    currentProofIndex = null;
    document.getElementById('proofOutput').style.display = 'none';
    document.getElementById('proofStatus').innerHTML = '';
    document.getElementById('verifyStatus').innerHTML = '';
    document.getElementById('verifyResult').style.display = 'none';

    // Reset proof select to default
    const proofSelect = document.getElementById('proofSelect');
    if (proofSelect.options.length > 0) {
        proofSelect.selectedIndex = 0;
    }

    // Reset verify inputs
    document.getElementById('verifyInput').value = '';
    const verifySelect = document.getElementById('verifySelect');
    if (verifySelect.options.length > 0) {
        verifySelect.selectedIndex = 0;
    }
    hideSearchResults();
}

/**
 * Copy text from an element to clipboard
 * @param {string} elementId - ID of the element to copy
 */
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Đã copy!');
    });
}

function downloadTreeStructure() {
    if (!currentTree) {
        alert('Vui lòng xây dựng tree trước!');
        return;
    }

    const content = currentTree.tree_structure;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merkle-tree-structure.txt';
    a.click();
    window.URL.revokeObjectURL(url);
}

/**
 * Load example data into the input field
 * @param {number} exampleNum - Example number (1, 2, or 3)
 */
function loadExample(exampleNum) {
    const examples = {
        1: 'Block 1\nBlock 2\nBlock 3\nBlock 4',
        2: 'Transaction A\nTransaction B\nTransaction C\nTransaction D\nTransaction E',
        3: 'Alice → Bob: 10 BTC\nCharlie → Dave: 5 BTC\nEve → Frank: 15 BTC\nGrace → Henry: 20 BTC'
    };

    document.getElementById('dataInput').value = examples[exampleNum] || '';
    updateLineCounter();
}

document.addEventListener('DOMContentLoaded', function () {
    updateLineCounter();
    loadExample(1);

    // Close search results when clicking outside
    document.addEventListener('click', function (e) {
        const wrapper = document.querySelector('.verify-search-wrapper');
        if (wrapper && !wrapper.contains(e.target))
            hideSearchResults();
    });
});
