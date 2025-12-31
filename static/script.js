let currentTree = null;
let currentProof = null;
let currentProofIndex = null;
let currentDataList = [];

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
        showStatus('buildStatus', '⏳ Đang xây dựng tree...', 'info');
        const response = await fetch('/api/build-tree', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: data })
        });

        const result = await response.json();
        if (!result.success) {
            showStatus('buildStatus', `❌ Lỗi: ${result.error}`, 'error');
            return;
        }

        currentTree = result;
        currentDataList = result.data_list || [];

        document.getElementById('rootHashDisplay').textContent = result.root_hash;
        document.getElementById('treeStructure').textContent = result.tree_structure;

        renderVisualTree(result.tree_levels);
        populateDataSelects();
        showStatus('buildStatus', `✅ Xây dựng thành công! ${result.leaf_count} phần tử, ${result.depth} levels`, 'success');
    }
    catch (error) {
        showStatus('buildStatus', `❌ Lỗi: ${error.message}`, 'error');
    }
}

function renderVisualTree(treeLevels) {
    const container = document.getElementById('treeVisual');
    if (!treeLevels || treeLevels.length === 0) {
        container.innerHTML = '<div class="tree-placeholder">Chưa xây dựng tree</div>';
        return;
    }

    let html = '';
    treeLevels.forEach((level, levelIndex) => {
        html += `<div class="tree-level">`;
        html += `<span class="tree-level-label">${level.level_name}</span>`;
        html += `<div class="tree-nodes">`;

        level.nodes.forEach((node, nodeIndex) => {
            let nodeClass = 'node-internal';
            if (node.is_root) nodeClass = 'node-root';
            else if (node.is_leaf) nodeClass = 'node-leaf';

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

        html += `</div>`;
        html += `</div>`;

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
        verifySelect.innerHTML = '<option value="" disabled selected>-- Vui lòng sinh proof trước --</option>';
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
    verifySelect.innerHTML = '<option value="" disabled selected>-- Chọn phần tử để kiểm tra --</option>';
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
            showStatus('proofStatus', `❌ Lỗi: ${result.error}`, 'error');
            return;
        }

        currentProof = result.proof;
        currentProofIndex = result.index;

        // Auto-select the corresponding item in verify dropdown
        const verifySelect = document.getElementById('verifySelect');
        verifySelect.value = result.leaf_data;

        let proofHTML = `
            <div class="info-section">
                <strong>🎯 Phần tử cần chứng minh:</strong> <code>${result.leaf_data}</code><br>
                <strong>📍 Chỉ số:</strong> ${result.index}<br>
                <strong>📜 Proof Path (${result.proof_steps} bước):</strong>
            </div>
        `;

        result.proof.forEach((step, i) => {
            proofHTML += `
                <div class="proof-item">
                    Bước ${i + 1}: Hash từ ${step.position === 'right' ? 'phải' : 'trái'} (Level ${step.level})<br>
                    ${step.hash_short}
                </div>
            `;
        });

        document.getElementById('proofPath').innerHTML = proofHTML;
        document.getElementById('proofOutput').style.display = 'block';

        showStatus('proofStatus', `✅ Sinh proof thành công! ${result.proof_steps} bước`, 'success');
    }
    catch (error) {
        showStatus('proofStatus', `❌ Lỗi: ${error.message}`, 'error');
    }
}

async function verifyProof() {
    if (!currentTree || !currentProof) {
        showStatus('verifyStatus', 'Vui lòng sinh proof trước!', 'error');
        return;
    }

    const verifySelect = document.getElementById('verifySelect');
    const verifyData = verifySelect.value;

    if (!verifyData) {
        showStatus('verifyStatus', 'Vui lòng chọn phần tử cần kiểm tra!', 'error');
        return;
    }

    try {
        showStatus('verifyStatus', '⏳ Đang kiểm tra...', 'info');
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
            showStatus('verifyStatus', `❌ Lỗi: ${result.error}`, 'error');
            return;
        }

        let resultHTML = `
            <div class="info-section">
                <strong>📝 Dữ liệu kiểm tra:</strong> <code>${result.leaf_data}</code><br>
                <strong>🔑 Root Hash:</strong> <code>${result.root_hash.substring(0, 32)}...</code>
            </div>
        `;

        if (result.is_valid) {
            resultHTML += `
                <div class="status success show">
                    ✅ <strong>HỢP LỆ!</strong> Dữ liệu match với proof. Root hash khớp!
                </div>
            `;
            showStatus('verifyStatus', '✅ Proof hợp lệ!', 'success');
        }
        else {
            resultHTML += `
                <div class="status error show">
                    ❌ <strong>KHÔNG HỢP LỆ!</strong> Dữ liệu không match. Root hash khác!
                </div>
            `;
            showStatus('verifyStatus', '❌ Proof không hợp lệ!', 'error');
        }

        document.getElementById('verifyComparison').innerHTML = resultHTML;
        document.getElementById('verifyResult').style.display = 'block';
    }
    catch (error) {
        showStatus('verifyStatus', `❌ Lỗi: ${error.message}`, 'error');
    }
}

async function demoDetectModification() {
    if (!currentTree || !currentProof) {
        showStatus('verifyStatus', 'Vui lòng sinh proof trước!', 'error');
        return;
    }

    try {
        showStatus('verifyStatus', '⏳ Đang demo phát hiện thay đổi...', 'info');
        const verifySelect = document.getElementById('verifySelect');
        const originalData = verifySelect.value;

        if (!originalData) {
            showStatus('verifyStatus', 'Vui lòng chọn phần tử để demo!', 'error');
            return;
        }

        const modifiedData = originalData + ' [MODIFIED]';

        const response = await fetch('/api/demo-detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                original_data: originalData,
                modified_data: modifiedData,
                proof: currentProof
            })
        });

        const result = await response.json();

        if (!result.success) {
            showStatus('verifyStatus', `❌ Lỗi: ${result.error}`, 'error');
            return;
        }

        let resultHTML = `
            <div class="info-section">
                <strong>📝 Dữ liệu gốc:</strong> <code>${result.original_data}</code><br>
                <strong>⚠️ Dữ liệu sau thay đổi:</strong> <code>${result.modified_data}</code>
            </div>
        `;

        if (result.detection_success) {
            resultHTML += `
                <div class="status error show">
                    ✅ <strong>PHÁT HIỆN THAY ĐỔI!</strong> Blockchain bảo mật - dữ liệu bị sửa bị lộ ngay!
                </div>
            `;
            showStatus('verifyStatus', '✅ Phát hiện thành công!', 'success');
        }
        else {
            resultHTML += `
                <div class="status success show">
                    ⚠️ Demo không như mong đợi
                </div>
            `;
        }

        document.getElementById('verifyComparison').innerHTML = resultHTML;
        document.getElementById('verifyResult').style.display = 'block';
    }
    catch (error) {
        showStatus('verifyStatus', `❌ Lỗi: ${error.message}`, 'error');
    }
}

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

    // Reset dropdowns
    document.getElementById('proofSelect').innerHTML = '<option value="" disabled selected>-- Vui lòng xây dựng tree trước --</option>';
    document.getElementById('verifySelect').innerHTML = '<option value="" disabled selected>-- Vui lòng sinh proof trước --</option>';

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

    // Reset verify select
    const verifySelect = document.getElementById('verifySelect');
    if (currentDataList.length > 0) {
        verifySelect.selectedIndex = 0;
    }
}

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

function loadExample(exampleNum) {
    const examples = {
        1: 'Block 1\nBlock 2\nBlock 3\nBlock 4',
        2: 'Transaction A\nTransaction B\nTransaction C\nTransaction D\nTransaction E',
        3: 'Alice → Bob: 10 BTC\nCharlie → Dave: 5 BTC\nEve → Frank: 15 BTC\nGrace → Henry: 20 BTC'
    };

    document.getElementById('dataInput').value = examples[exampleNum] || '';
    updateLineCounter();
}

// Initialize line counter on page load
document.addEventListener('DOMContentLoaded', function () {
    updateLineCounter();
});
