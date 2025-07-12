// 全域變數
let currentFiles = [];
let processedImages = [];

// DOM 元素
const toolStatus = document.getElementById('toolStatus');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectedFiles = document.getElementById('selectedFiles');
const fileList = document.getElementById('fileList');
const processBtn = document.getElementById('processBtn');
const processingSection = document.getElementById('processingSection');
const resultsSection = document.getElementById('resultsSection');
const progressFill = document.getElementById('progressFill');
const statusText = document.getElementById('statusText');
const originalCanvas = document.getElementById('originalCanvas');
const processedCanvas = document.getElementById('processedCanvas');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');

// 初始化事件監聽器
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    console.log('文件掃描工具已載入 - 高性能版本');
});

function initializeEventListeners() {
    // 檔案輸入事件
    fileInput.addEventListener('change', handleFileSelect);
    
    // 拖放事件
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // 按鈕事件
    processBtn.addEventListener('click', startProcessing);
    downloadBtn.addEventListener('click', downloadProcessedImage);
    resetBtn.addEventListener('click', resetApplication);
}

// 拖放事件處理
function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/') && !file.type.includes('heic') && !file.type.includes('heif')
    );
    displaySelectedFiles(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files).filter(file => 
        file.type.startsWith('image/') && !file.type.includes('heic') && !file.type.includes('heif')
    );
    displaySelectedFiles(files);
}

// 顯示已選擇的檔案
function displaySelectedFiles(files) {
    if (files.length === 0) {
        alert('請選擇有效的圖片檔案 (JPG, PNG, GIF, BMP)');
        return;
    }
    
    currentFiles = files;
    fileList.innerHTML = '';
    
    files.forEach((file, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${formatFileSize(file.size)})</span>
            </div>
            <span class="file-status ready" id="status-${index}">準備就緒</span>
        `;
        fileList.appendChild(li);
    });
    
    selectedFiles.style.display = 'block';
    processBtn.disabled = false;
}

// 格式化檔案大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 開始處理
async function startProcessing() {
    if (currentFiles.length === 0) return;
    
    processBtn.disabled = true;
    showProcessingSection();
    processedImages = [];
    
    try {
        updateProgress(5, '準備處理檔案...');
        
        for (let i = 0; i < currentFiles.length; i++) {
            const file = currentFiles[i];
            const progressStart = 5 + (i / currentFiles.length) * 85;
            updateProgress(progressStart, `處理第 ${i + 1} 個檔案：${file.name}`);
            
            // 更新檔案狀態
            const statusElement = document.getElementById(`status-${i}`);
            if (statusElement) {
                statusElement.textContent = '處理中...';
                statusElement.className = 'file-status processing';
            }
            
            try {
                const processedImage = await processImageFast(file, (progress, status) => {
                    const overallProgress = progressStart + (progress / currentFiles.length);
                    updateProgress(overallProgress, status);
                });
                
                processedImages.push(processedImage);
                
                if (statusElement) {
                    statusElement.textContent = '完成';
                    statusElement.className = 'file-status ready';
                }
                
            } catch (error) {
                console.error(`處理檔案 ${file.name} 時發生錯誤：`, error);
                if (statusElement) {
                    statusElement.textContent = '錯誤';
                    statusElement.className = 'file-status error';
                }
                processedImages.push(null);
            }
        }
        
        updateProgress(95, '準備顯示結果...');
        
        const successfulImages = processedImages.filter(img => img !== null);
        
        if (successfulImages.length > 0) {
            updateProgress(100, `處理完成！成功處理 ${successfulImages.length} 個檔案`);
            showResults();
        } else {
            updateProgress(0, '所有檔案處理失敗，請檢查檔案格式或重新嘗試');
            processBtn.disabled = false;
        }
        
    } catch (error) {
        console.error('處理檔案時發生錯誤：', error);
        updateProgress(0, '處理失敗：' + error.message);
        processBtn.disabled = false;
    }
}

// 快速圖像處理主函數
async function processImageFast(file, progressCallback) {
    console.log(`開始快速處理檔案: ${file.name}`);
    
    try {
        // 步驟 1: 載入圖像
        progressCallback(10, '載入圖像...');
        const originalImage = await loadImageToCanvas(file);
        
        // 步驟 2: 快速文件掃描處理
        progressCallback(30, '分析文件邊界...');
        const processedImage = await fastDocumentScan(originalImage, progressCallback);
        
        progressCallback(100, '處理完成');
        
        return {
            original: originalImage,
            processed: processedImage,
            filename: file.name
        };
        
    } catch (error) {
        console.error('處理圖像時發生錯誤：', error);
        throw new Error(`處理 ${file.name} 失敗: ${error.message}`);
    }
}

// 載入圖像到 Canvas (優化版)
function loadImageToCanvas(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        let objectUrl = null;
        
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 優化: 限制最大尺寸以提高性能
                const maxSize = 1000; // 降低解析度提升速度
                let { width, height } = img;
                
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 白色背景
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                
                // 繪製圖像
                ctx.drawImage(img, 0, 0, width, height);
                
                // 清理 URL
                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                }
                
                resolve({
                    canvas: canvas,
                    width: width,
                    height: height
                });
            } catch (error) {
                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                }
                reject(new Error('無法繪製圖像到 Canvas'));
            }
        };
        
        img.onerror = () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
            reject(new Error(`無法載入圖像: ${file.name}`));
        };
        
        try {
            objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
        } catch (error) {
            reject(new Error(`無法建立圖像 URL: ${file.name}`));
        }
    });
}

// 文件掃描處理
async function fastDocumentScan(imageData, progressCallback) {
    const { canvas, width, height } = imageData;
    
    // 步驟 1: 改進的邊界檢測
    progressCallback(30, '檢測文件邊界...');
    const corners = improvedBorderDetection(canvas);
    
    // 步驟 2: 四邊形裁切和透視校正
    progressCallback(50, '裁切和校正文件...');
    let correctedImage;
    if (corners && corners.length === 4) {
        console.log('找到四角，執行四邊形裁切和透視校正:', corners);
        // 先裁切出傾斜的四邊形，再進行透視校正
        correctedImage = cropQuadrilateralAndCorrect(canvas, corners);
    } else {
        console.log('未找到四角，使用增強智能裁切');
        correctedImage = enhancedSmartCrop(imageData, 0.05); // 5% 更精確的裁切
    }
    
    // 步驟 3: 影像強化
    progressCallback(70, '強化影像品質...');
    const enhancedImage = fastImageEnhancement(correctedImage);
    
    // 步驟 4: 轉換為灰階
    progressCallback(85, '轉換為灰階...');
    const grayscaleImage = convertToGrayscale(enhancedImage);
    
    progressCallback(95, '完成處理...');
    
    return grayscaleImage;
}

// 重新設計的文件邊界檢測
function improvedBorderDetection(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    console.log('開始文件邊界檢測...');
    
    // 方法1: 簡化但有效的邊緣檢測
    let corners = simpleEdgeDetection(canvas);
    
    if (corners && corners.length === 4) {
        console.log('簡化邊緣檢測成功找到四角:', corners);
        // 驗證角點品質
        if (validateAndRefineCorners(corners, width, height)) {
            return corners;
        }
    }
    
    // 方法2: 顏色分析檢測
    corners = colorBasedDetection(canvas);
    
    if (corners && corners.length === 4) {
        console.log('顏色分析檢測成功找到四角:', corners);
        if (validateAndRefineCorners(corners, width, height)) {
            return corners;
        }
    }
    
    console.log('邊界檢測失敗，將使用智能裁切');
    return null;
}

// 簡化但有效的邊緣檢測
function simpleEdgeDetection(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // 縮小分析以提高效率
    const scale = 0.25;
    const smallWidth = Math.floor(width * scale);
    const smallHeight = Math.floor(height * scale);
    
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = smallWidth;
    smallCanvas.height = smallHeight;
    const smallCtx = smallCanvas.getContext('2d');
    
    // 增強對比度以突出文件邊界
    smallCtx.filter = 'contrast(300%) brightness(150%) saturate(0%)';
    smallCtx.drawImage(canvas, 0, 0, smallWidth, smallHeight);
    
    const imageData = smallCtx.getImageData(0, 0, smallWidth, smallHeight);
    const data = imageData.data;
    
    // 使用簡單的闾值和形態學操作找到文件邊界
    const binary = new Uint8Array(smallWidth * smallHeight);
    
    // 計算闾值
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    const avgBrightness = sum / (data.length / 4);
    const threshold = avgBrightness * 0.8; // 動態闾值
    
    // 二值化
    for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        binary[i / 4] = brightness < threshold ? 0 : 255;
    }
    
    // 形態學操作 - 開運算來清理小匹青
    const cleaned = morphologyOpen(binary, smallWidth, smallHeight);
    
    // 找到最大的連通區域
    const largestComponent = findLargestConnectedComponent(cleaned, smallWidth, smallHeight);
    
    if (!largestComponent) {
        return null;
    }
    
    // 從最大連通區域提取角點
    const corners = extractCornersFromComponent(largestComponent, smallWidth, smallHeight);
    
    if (corners && corners.length === 4) {
        // 縮放回原始尺寸
        return corners.map(corner => ({
            x: Math.floor(corner.x / scale),
            y: Math.floor(corner.y / scale)
        }));
    }
    
    return null;
}

// 形態學開運算
function morphologyOpen(binary, width, height) {
    // 先腐蝕再膨脹
    const eroded = morphologyErode(binary, width, height);
    return morphologyDilate(eroded, width, height);
}

// 腐蝕操作
function morphologyErode(binary, width, height) {
    const result = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            
            // 檢查 3x3 鄰域
            let allWhite = true;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (binary[(y + dy) * width + (x + dx)] !== 255) {
                        allWhite = false;
                        break;
                    }
                }
                if (!allWhite) break;
            }
            
            result[idx] = allWhite ? 255 : 0;
        }
    }
    
    return result;
}

// 膨脹操作
function morphologyDilate(binary, width, height) {
    const result = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            
            // 檢查 3x3 鄰域
            let hasWhite = false;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (binary[(y + dy) * width + (x + dx)] === 255) {
                        hasWhite = true;
                        break;
                    }
                }
                if (hasWhite) break;
            }
            
            result[idx] = hasWhite ? 255 : 0;
        }
    }
    
    return result;
}

// 找到最大連通區域
function findLargestConnectedComponent(binary, width, height) {
    const visited = new Uint8Array(width * height);
    let largestComponent = null;
    let maxSize = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            
            if (binary[idx] === 255 && visited[idx] === 0) {
                const component = floodFill(binary, visited, x, y, width, height);
                
                if (component.length > maxSize) {
                    maxSize = component.length;
                    largestComponent = component;
                }
            }
        }
    }
    
    // 確保連通區域大小合理
    const minSize = (width * height) * 0.1; // 至少佔10%的圖像大小
    const maxSize_limit = (width * height) * 0.8; // 最多80%的圖像大小
    
    if (maxSize > minSize && maxSize < maxSize_limit) {
        return largestComponent;
    }
    
    return null;
}

// 洸水填充算法
function floodFill(binary, visited, startX, startY, width, height) {
    const component = [];
    const stack = [{ x: startX, y: startY }];
    
    while (stack.length > 0) {
        const { x, y } = stack.pop();
        const idx = y * width + x;
        
        if (x < 0 || x >= width || y < 0 || y >= height ||
            visited[idx] === 1 || binary[idx] !== 255) {
            continue;
        }
        
        visited[idx] = 1;
        component.push({ x, y });
        
        // 4-連通
        stack.push({ x: x + 1, y });
        stack.push({ x: x - 1, y });
        stack.push({ x, y: y + 1 });
        stack.push({ x, y: y - 1 });
    }
    
    return component;
}

// 從連通區域提取角點
function extractCornersFromComponent(component, width, height) {
    if (component.length < 4) return null;
    
    // 找到邊界點
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    for (const point of component) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }
    
    // 初始角點推測
    const roughCorners = [
        { x: minX, y: minY }, // 左上
        { x: maxX, y: minY }, // 右上
        { x: maxX, y: maxY }, // 右下
        { x: minX, y: maxY }  // 左下
    ];
    
    // 精練角點：在連通區域中找到最接近的實際點
    const refinedCorners = [];
    
    for (const roughCorner of roughCorners) {
        let bestPoint = null;
        let minDistance = Infinity;
        
        for (const point of component) {
            const distance = Math.sqrt(
                (point.x - roughCorner.x) ** 2 + (point.y - roughCorner.y) ** 2
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                bestPoint = point;
            }
        }
        
        if (bestPoint) {
            refinedCorners.push(bestPoint);
        }
    }
    
    return refinedCorners.length === 4 ? refinedCorners : null;
}

// 驗證和精練角點
function validateAndRefineCorners(corners, width, height) {
    if (corners.length !== 4) return false;
    
    // 檢查角點是否在圖像範圍內
    for (const corner of corners) {
        if (corner.x < 0 || corner.x >= width || corner.y < 0 || corner.y >= height) {
            return false;
        }
    }
    
    // 檢查是否形成合理的四邊形
    const area = calculateContourArea(corners);
    const imageArea = width * height;
    
    if (area < imageArea * 0.05 || area > imageArea * 0.95) {
        return false;
    }
    
    // 檢查是否為凸四邊形
    return isConvexQuadrilateral(corners);
}

// 增強的輪廓檢測
function enhancedContourDetection(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // 創建處理用的小尺寸圖像
    const scale = 0.4;
    const smallWidth = Math.floor(width * scale);
    const smallHeight = Math.floor(height * scale);
    
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = smallWidth;
    smallCanvas.height = smallHeight;
    const smallCtx = smallCanvas.getContext('2d');
    
    // 繪製並增強對比度
    smallCtx.filter = 'contrast(200%) brightness(120%)';
    smallCtx.drawImage(canvas, 0, 0, smallWidth, smallHeight);
    
    const imageData = smallCtx.getImageData(0, 0, smallWidth, smallHeight);
    const data = imageData.data;
    
    // 轉為灰階
    const gray = new Uint8Array(smallWidth * smallHeight);
    for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    // 應用邊緣檢測
    const edges = improvedEdgeDetection(gray, smallWidth, smallHeight);
    
    // 尋找文件矩形
    const corners = findDocumentRectangle(edges, smallWidth, smallHeight);
    
    if (corners && corners.length === 4) {
        // 縮放回原始尺寸
        return corners.map(corner => ({
            x: Math.floor(corner.x / scale),
            y: Math.floor(corner.y / scale)
        }));
    }
    
    return null;
}

// 改進的邊緣檢測
function improvedEdgeDetection(gray, width, height) {
    const edges = new Uint8Array(width * height);
    const threshold = 30;
    
    // 使用簡化的邊緣檢測
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            
            // 計算梯度
            const gradX = Math.abs(gray[idx + 1] - gray[idx - 1]);
            const gradY = Math.abs(gray[idx + width] - gray[idx - width]);
            const gradient = gradX + gradY;
            
            // 強化矩形邊緣
            if (gradient > threshold) {
                // 檢查是否為水平或垂直邊緣
                const isHorizontal = gradY > gradX * 1.5;
                const isVertical = gradX > gradY * 1.5;
                
                if (isHorizontal || isVertical) {
                    edges[idx] = 255;
                }
            }
        }
    }
    
    // 邊緣清理和連接
    return cleanupEdges(edges, width, height);
}

// 邊緣清理
function cleanupEdges(edges, width, height) {
    const cleaned = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            
            if (edges[idx] === 255) {
                // 計算鄰域邊緣點數量
                let neighbors = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (edges[(y + dy) * width + (x + dx)] === 255) {
                            neighbors++;
                        }
                    }
                }
                
                // 保留有足夠鄰居的邊緣點
                if (neighbors >= 2) {
                    cleaned[idx] = 255;
                }
            }
        }
    }
    
    return cleaned;
}

// 尋找文件矩形
function findDocumentRectangle(edges, width, height) {
    // 使用輪廓跟蹤找到最大的矩形區域
    const contours = findContours(edges, width, height);
    
    if (contours.length === 0) {
        return null;
    }
    
    // 找到最大的輪廓
    let largestContour = contours[0];
    let maxArea = 0;
    
    for (const contour of contours) {
        const area = calculateContourArea(contour);
        if (area > maxArea) {
            maxArea = area;
            largestContour = contour;
        }
    }
    
    // 從最大輪廓中提取矩形角點
    const corners = extractRectangleCorners(largestContour, width, height);
    
    if (corners && corners.length === 4) {
        // 驗證角點是否形成合理的矩形
        if (validateRectangle(corners, width, height)) {
            return corners;
        }
    }
    
    return null;
}

// 輪廓跟蹤
function findContours(edges, width, height) {
    const visited = new Uint8Array(width * height);
    const contours = [];
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            
            if (edges[idx] === 255 && visited[idx] === 0) {
                const contour = traceContour(edges, visited, x, y, width, height);
                if (contour.length > 20) { // 過濾小輪廓
                    contours.push(contour);
                }
            }
        }
    }
    
    return contours;
}

// 輪廓跟蹤
function traceContour(edges, visited, startX, startY, width, height) {
    const contour = [];
    const stack = [{ x: startX, y: startY }];
    
    while (stack.length > 0) {
        const { x, y } = stack.pop();
        const idx = y * width + x;
        
        if (x < 0 || x >= width || y < 0 || y >= height ||
            visited[idx] === 1 || edges[idx] !== 255) {
            continue;
        }
        
        visited[idx] = 1;
        contour.push({ x, y });
        
        // 添加8連通鄰域
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx !== 0 || dy !== 0) {
                    stack.push({ x: x + dx, y: y + dy });
                }
            }
        }
    }
    
    return contour;
}

// 檢測直線
function detectLines(edges, width, height) {
    const lines = [];
    const threshold = Math.min(width, height) * 0.3;
    
    // 檢測水平線
    for (let y = 0; y < height; y += 2) {
        let start = -1;
        let edgeCount = 0;
        
        for (let x = 0; x < width; x++) {
            if (edges[y * width + x] === 255) {
                if (start === -1) start = x;
                edgeCount++;
            } else {
                if (start !== -1 && edgeCount > threshold * 0.5) {
                    lines.push({
                        type: 'horizontal',
                        y: y,
                        x1: start,
                        x2: x - 1,
                        strength: edgeCount
                    });
                }
                start = -1;
                edgeCount = 0;
            }
        }
    }
    
    // 檢測垂直線
    for (let x = 0; x < width; x += 2) {
        let start = -1;
        let edgeCount = 0;
        
        for (let y = 0; y < height; y++) {
            if (edges[y * width + x] === 255) {
                if (start === -1) start = y;
                edgeCount++;
            } else {
                if (start !== -1 && edgeCount > threshold * 0.5) {
                    lines.push({
                        type: 'vertical',
                        x: x,
                        y1: start,
                        y2: y - 1,
                        strength: edgeCount
                    });
                }
                start = -1;
                edgeCount = 0;
            }
        }
    }
    
    // 按強度排序，選擇最強的線
    lines.sort((a, b) => b.strength - a.strength);
    return lines.slice(0, 10);
}

// 計算線段交點
function getLineIntersection(line1, line2) {
    if (line1.type === line2.type) return null;
    
    if (line1.type === 'horizontal' && line2.type === 'vertical') {
        return { x: line2.x, y: line1.y };
    } else if (line1.type === 'vertical' && line2.type === 'horizontal') {
        return { x: line1.x, y: line2.y };
    }
    
    return null;
}

// 計算輪廓面積
function calculateContourArea(contour) {
    if (contour.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
        const j = (i + 1) % contour.length;
        area += contour[i].x * contour[j].y;
        area -= contour[j].x * contour[i].y;
    }
    return Math.abs(area) / 2;
}

// 從輪廓提取矩形角點
function extractRectangleCorners(contour, width, height) {
    if (contour.length < 4) return null;
    
    // 找到輪廓的包圍盒
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    for (const point of contour) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }
    
    // 使用道格拉斯-普克算法簡化輪廓
    const simplified = douglasPeucker(contour, 10);
    
    if (simplified.length >= 4) {
        // 尋找最接近矩形的四個角點
        return findBestFourCorners(simplified, width, height);
    }
    
    return null;
}

// 道格拉斯-普克算法
function douglasPeucker(points, epsilon) {
    if (points.length <= 2) return points;
    
    // 找到距離最大的點
    let maxDistance = 0;
    let index = 0;
    const start = points[0];
    const end = points[points.length - 1];
    
    for (let i = 1; i < points.length - 1; i++) {
        const distance = pointToLineDistance(points[i], start, end);
        if (distance > maxDistance) {
            maxDistance = distance;
            index = i;
        }
    }
    
    if (maxDistance > epsilon) {
        const left = douglasPeucker(points.slice(0, index + 1), epsilon);
        const right = douglasPeucker(points.slice(index), epsilon);
        return left.slice(0, -1).concat(right);
    }
    
    return [start, end];
}

// 點到直線距離
function pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
        xx = lineStart.x;
        yy = lineStart.y;
    } else if (param > 1) {
        xx = lineEnd.x;
        yy = lineEnd.y;
    } else {
        xx = lineStart.x + param * C;
        yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// 找到最佳四角
function findBestFourCorners(points, width, height) {
    if (points.length < 4) return null;
    
    // 計算中心點
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 按距離中心的角度排序
    points.sort((a, b) => {
        const angleA = Math.atan2(a.y - centerY, a.x - centerX);
        const angleB = Math.atan2(b.y - centerY, b.x - centerX);
        return angleA - angleB;
    });
    
    // 選擇四個最遠的角
    const corners = [];
    const step = Math.max(1, Math.floor(points.length / 4));
    
    for (let i = 0; i < 4 && i * step < points.length; i++) {
        corners.push(points[i * step]);
    }
    
    return corners.length === 4 ? corners : null;
}

// 驗證矩形合理性
function validateRectangle(corners, width, height) {
    if (corners.length !== 4) return false;
    
    // 檢查面積是否合理
    const area = calculateContourArea(corners);
    const imageArea = width * height;
    
    if (area < imageArea * 0.1 || area > imageArea * 0.9) {
        return false;
    }
    
    // 檢查是否形成凸四邊形
    return isConvexQuadrilateral(corners);
}

// 檢查是否為凸四邊形
function isConvexQuadrilateral(corners) {
    if (corners.length !== 4) return false;
    
    // 檢查所有角度是否小於180度
    for (let i = 0; i < 4; i++) {
        const p1 = corners[i];
        const p2 = corners[(i + 1) % 4];
        const p3 = corners[(i + 2) % 4];
        
        const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
        
        if (i === 0) {
            var sign = cross > 0;
        } else if ((cross > 0) !== sign) {
            return false;
        }
    }
    
    return true;
}

// 顏色分析檢測
function colorBasedDetection(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // 縮小圖像進行分析
    const scale = 0.3;
    const smallWidth = Math.floor(width * scale);
    const smallHeight = Math.floor(height * scale);
    
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = smallWidth;
    smallCanvas.height = smallHeight;
    const smallCtx = smallCanvas.getContext('2d');
    
    smallCtx.drawImage(canvas, 0, 0, smallWidth, smallHeight);
    
    const imageData = smallCtx.getImageData(0, 0, smallWidth, smallHeight);
    const data = imageData.data;
    
    // 分析主要顏色和背景顏色
    const histogram = analyzeColorHistogram(data);
    const mask = createColorMask(data, histogram, smallWidth, smallHeight);
    
    // 從遮罩中找到矩形
    const corners = findRectangleFromMask(mask, smallWidth, smallHeight);
    
    if (corners && corners.length === 4) {
        return corners.map(corner => ({
            x: Math.floor(corner.x / scale),
            y: Math.floor(corner.y / scale)
        }));
    }
    
    return null;
}

// 顏色直方圖分析
function analyzeColorHistogram(data) {
    const histogram = { bright: 0, dark: 0, mid: 0 };
    
    for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        
        if (brightness > 180) {
            histogram.bright++;
        } else if (brightness < 80) {
            histogram.dark++;
        } else {
            histogram.mid++;
        }
    }
    
    return histogram;
}

// 創建顏色遮罩
function createColorMask(data, histogram, width, height) {
    const mask = new Uint8Array(width * height);
    const total = data.length / 4;
    
    // 決定文件是暗色還是亮色
    const isDarkDocument = histogram.dark > total * 0.3;
    
    for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const pixelIndex = i / 4;
        
        if (isDarkDocument) {
            // 暗色文件：標記暗色區域
            mask[pixelIndex] = brightness < 120 ? 255 : 0;
        } else {
            // 亮色文件：標記非背景區域
            mask[pixelIndex] = brightness < 220 ? 255 : 0;
        }
    }
    
    return mask;
}

// 從遮罩中找矩形
function findRectangleFromMask(mask, width, height) {
    // 找到遮罩的包圍盒
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasContent = false;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (mask[y * width + x] === 255) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                hasContent = true;
            }
        }
    }
    
    if (!hasContent) return null;
    
    // 添加一些邊界
    const margin = Math.min(width, height) * 0.05;
    minX = Math.max(0, minX - margin);
    maxX = Math.min(width - 1, maxX + margin);
    minY = Math.max(0, minY - margin);
    maxY = Math.min(height - 1, maxY + margin);
    
    return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
    ];
}

// 選擇最佳的四個角點
function selectBestFourCorners(intersections, width, height) {
    if (intersections.length < 4) return null;
    
    // 計算中心點
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 按象限分組
    const quadrants = {
        topLeft: [],
        topRight: [],
        bottomRight: [],
        bottomLeft: []
    };
    
    for (const point of intersections) {
        if (point.x < centerX && point.y < centerY) {
            quadrants.topLeft.push(point);
        } else if (point.x >= centerX && point.y < centerY) {
            quadrants.topRight.push(point);
        } else if (point.x >= centerX && point.y >= centerY) {
            quadrants.bottomRight.push(point);
        } else {
            quadrants.bottomLeft.push(point);
        }
    }
    
    // 從每個象限選擇最極端的點
    const corners = [];
    
    // 左上角：最小 x+y
    if (quadrants.topLeft.length > 0) {
        corners.push(quadrants.topLeft.sort((a, b) => (a.x + a.y) - (b.x + b.y))[0]);
    }
    
    // 右上角：最大 x，最小 y
    if (quadrants.topRight.length > 0) {
        corners.push(quadrants.topRight.sort((a, b) => (b.x - a.x) + (a.y - b.y))[0]);
    }
    
    // 右下角：最大 x+y
    if (quadrants.bottomRight.length > 0) {
        corners.push(quadrants.bottomRight.sort((a, b) => (b.x + b.y) - (a.x + a.y))[0]);
    }
    
    // 左下角：最小 x，最大 y
    if (quadrants.bottomLeft.length > 0) {
        corners.push(quadrants.bottomLeft.sort((a, b) => (a.x - b.x) + (b.y - a.y))[0]);
    }
    
    return corners.length === 4 ? corners : null;
}

// 四邊形裁切和透視校正
function cropQuadrilateralAndCorrect(canvas, corners) {
    console.log('開始四邊形裁切和透視校正，原始角點:', corners);
    
    // 第一步：創建只包含四邊形區域的遮罩和裁切的邊界框
    const boundingBox = getBoundingBox(corners);
    console.log('包圍盒:', boundingBox);
    
    // 擴展邊界框，確保包含完整的四邊形
    const padding = 10;
    const expandedBox = {
        x: Math.max(0, boundingBox.x - padding),
        y: Math.max(0, boundingBox.y - padding),
        width: Math.min(canvas.width - boundingBox.x + padding, boundingBox.width + 2 * padding),
        height: Math.min(canvas.height - boundingBox.y + padding, boundingBox.height + 2 * padding)
    };
    
    // 調整角點座標相對於新的裁切區域
    const adjustedCorners = corners.map(corner => ({
        x: corner.x - expandedBox.x,
        y: corner.y - expandedBox.y
    }));
    
    console.log('調整後角點:', adjustedCorners);
    
    // 第二步：裁切出包含四邊形的區域
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = expandedBox.width;
    croppedCanvas.height = expandedBox.height;
    const croppedCtx = croppedCanvas.getContext('2d');
    
    // 白色背景
    croppedCtx.fillStyle = '#ffffff';
    croppedCtx.fillRect(0, 0, expandedBox.width, expandedBox.height);
    
    // 裁切圖像
    croppedCtx.drawImage(
        canvas,
        expandedBox.x, expandedBox.y, expandedBox.width, expandedBox.height,
        0, 0, expandedBox.width, expandedBox.height
    );
    
    // 第三步：對裁切後的圖像進行透視校正
    return improvedPerspectiveCorrection(croppedCanvas, adjustedCorners);
}

// 獲取角點的包圍盒
function getBoundingBox(corners) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const corner of corners) {
        minX = Math.min(minX, corner.x);
        maxX = Math.max(maxX, corner.x);
        minY = Math.min(minY, corner.y);
        maxY = Math.max(maxY, corner.y);
    }
    
    return {
        x: Math.floor(minX),
        y: Math.floor(minY),
        width: Math.ceil(maxX - minX),
        height: Math.ceil(maxY - minY)
    };
}

// 改進的透視校正 - 更精確的方向處理
function improvedPerspectiveCorrection(canvas, corners) {
    console.log('開始透視校正，原始角點:', corners);
    
    // 排序角點 - 使用更精確的排序方法
    const sortedCorners = sortCornersByGeometry(corners);
    console.log('排序後角點:', sortedCorners);
    
    // 計算各邊長度
    const sides = [
        distance(sortedCorners[0], sortedCorners[1]), // 上邊
        distance(sortedCorners[1], sortedCorners[2]), // 右邊
        distance(sortedCorners[2], sortedCorners[3]), // 下邊
        distance(sortedCorners[3], sortedCorners[0])  // 左邊
    ];
    
    console.log('各邊長度:', sides.map(s => s.toFixed(1)));
    
    // 決定方向：比較對邊的平均長度
    const horizontalLength = (sides[0] + sides[2]) / 2; // 上下邊平均
    const verticalLength = (sides[1] + sides[3]) / 2;   // 左右邊平均
    
    // 短邊作為水平方向
    let outputWidth, outputHeight, finalCorners;
    
    if (horizontalLength < verticalLength) {
        // 水平邊較短，維持現有方向
        outputWidth = horizontalLength;
        outputHeight = verticalLength;
        finalCorners = sortedCorners;
        console.log('水平邊較短，保持方向');
    } else {
        // 垂直邊較短，需要旋轉 90 度
        outputWidth = verticalLength;
        outputHeight = horizontalLength;
        // 旋轉角點順序：左上 -> 右上 -> 右下 -> 左下 變成 左下 -> 左上 -> 右上 -> 右下
        finalCorners = [sortedCorners[3], sortedCorners[0], sortedCorners[1], sortedCorners[2]];
        console.log('垂直邊較短，旋轉 90 度');
    }
    
    // 限制輸出尺寸
    const maxSize = 800;
    const scale = Math.min(maxSize / outputWidth, maxSize / outputHeight, 1);
    const finalWidth = Math.floor(outputWidth * scale);
    const finalHeight = Math.floor(outputHeight * scale);
    
    console.log(`計算尺寸: ${outputWidth.toFixed(1)} x ${outputHeight.toFixed(1)}`);
    console.log(`最終尺寸: ${finalWidth} x ${finalHeight}`);
    
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = finalWidth;
    outputCanvas.height = finalHeight;
    const ctx = outputCanvas.getContext('2d');
    
    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalWidth, finalHeight);
    
    // 執行透視變換
    performPerspectiveTransform(canvas, outputCanvas, finalCorners);
    
    return {
        canvas: outputCanvas,
        width: finalWidth,
        height: finalHeight
    };
}

// 按幾何特性排序角點
function sortCornersByGeometry(corners) {
    if (corners.length !== 4) {
        throw new Error('需要正好4個角點');
    }
    
    // 計算中心點
    const centerX = corners.reduce((sum, p) => sum + p.x, 0) / 4;
    const centerY = corners.reduce((sum, p) => sum + p.y, 0) / 4;
    
    // 為每個角點計算相對於中心的角度
    const cornersWithAngles = corners.map(corner => ({
        ...corner,
        angle: Math.atan2(corner.y - centerY, corner.x - centerX)
    }));
    
    // 按角度排序（逆時針）
    cornersWithAngles.sort((a, b) => a.angle - b.angle);
    
    // 找到最左上的點作為起始點
    let startIndex = 0;
    let minSum = Infinity;
    
    for (let i = 0; i < 4; i++) {
        const sum = cornersWithAngles[i].x + cornersWithAngles[i].y;
        if (sum < minSum) {
            minSum = sum;
            startIndex = i;
        }
    }
    
    // 從最左上的點開始，順時針排列為：左上、右上、右下、左下
    const result = [];
    for (let i = 0; i < 4; i++) {
        const index = (startIndex + i) % 4;
        result.push({
            x: cornersWithAngles[index].x,
            y: cornersWithAngles[index].y
        });
    }
    
    return result;
}

// 計算兩點間距離
function distance(p1, p2) {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// 改進的角點排序 - 根據矩形屬性排序
function sortCornersByPosition(corners) {
    if (corners.length !== 4) {
        throw new Error('需要正好4個角點');
    }
    
    // 計算中心點
    const centerX = corners.reduce((sum, p) => sum + p.x, 0) / 4;
    const centerY = corners.reduce((sum, p) => sum + p.y, 0) / 4;
    
    // 按角度排序（順時針）
    const sorted = corners.map(corner => ({
        ...corner,
        angle: Math.atan2(corner.y - centerY, corner.x - centerX)
    })).sort((a, b) => a.angle - b.angle);
    
    // 找到最左上的點作為起點
    let startIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < 4; i++) {
        const distance = sorted[i].x + sorted[i].y;
        if (distance < minDistance) {
            minDistance = distance;
            startIndex = i;
        }
    }
    
    // 從最左上的點開始順時針排列
    const result = [];
    for (let i = 0; i < 4; i++) {
        const index = (startIndex + i) % 4;
        result.push({
            x: sorted[index].x,
            y: sorted[index].y
        });
    }
    
    return result;
}

// 執行透視變換
function performPerspectiveTransform(srcCanvas, dstCanvas, corners) {
    const srcCtx = srcCanvas.getContext('2d');
    const dstCtx = dstCanvas.getContext('2d');
    
    const srcImageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const dstImageData = dstCtx.createImageData(dstCanvas.width, dstCanvas.height);
    
    const [tl, tr, br, bl] = corners;
    
    // 使用双線性插值進行透視變換
    for (let y = 0; y < dstCanvas.height; y++) {
        for (let x = 0; x < dstCanvas.width; x++) {
            // 正規化座標 (0-1)
            const u = x / dstCanvas.width;
            const v = y / dstCanvas.height;
            
            // 双線性插值計算原始座標
            const top = lerp(tl, tr, u);
            const bottom = lerp(bl, br, u);
            const srcPoint = lerp(top, bottom, v);
            
            // 獲取像素值
            if (srcPoint.x >= 0 && srcPoint.x < srcCanvas.width &&
                srcPoint.y >= 0 && srcPoint.y < srcCanvas.height) {
                
                const srcPixel = bilinearInterpolation(srcImageData, srcPoint.x, srcPoint.y);
                const dstIdx = (y * dstCanvas.width + x) * 4;
                
                dstImageData.data[dstIdx] = srcPixel.r;
                dstImageData.data[dstIdx + 1] = srcPixel.g;
                dstImageData.data[dstIdx + 2] = srcPixel.b;
                dstImageData.data[dstIdx + 3] = 255;
            } else {
                // 白色背景
                const dstIdx = (y * dstCanvas.width + x) * 4;
                dstImageData.data[dstIdx] = 255;
                dstImageData.data[dstIdx + 1] = 255;
                dstImageData.data[dstIdx + 2] = 255;
                dstImageData.data[dstIdx + 3] = 255;
            }
        }
    }
    
    dstCtx.putImageData(dstImageData, 0, 0);
}

// 線性插值
function lerp(p1, p2, t) {
    return {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
    };
}

// 双線性插值
function bilinearInterpolation(imageData, x, y) {
    const x1 = Math.floor(x);
    const y1 = Math.floor(y);
    const x2 = Math.min(x1 + 1, imageData.width - 1);
    const y2 = Math.min(y1 + 1, imageData.height - 1);
    
    const dx = x - x1;
    const dy = y - y1;
    
    const getPixel = (px, py) => {
        const idx = (py * imageData.width + px) * 4;
        return {
            r: imageData.data[idx],
            g: imageData.data[idx + 1],
            b: imageData.data[idx + 2]
        };
    };
    
    const p1 = getPixel(x1, y1);
    const p2 = getPixel(x2, y1);
    const p3 = getPixel(x1, y2);
    const p4 = getPixel(x2, y2);
    
    return {
        r: Math.round(p1.r * (1 - dx) * (1 - dy) + p2.r * dx * (1 - dy) + 
                     p3.r * (1 - dx) * dy + p4.r * dx * dy),
        g: Math.round(p1.g * (1 - dx) * (1 - dy) + p2.g * dx * (1 - dy) + 
                     p3.g * (1 - dx) * dy + p4.g * dx * dy),
        b: Math.round(p1.b * (1 - dx) * (1 - dy) + p2.b * dx * (1 - dy) + 
                     p3.b * (1 - dx) * dy + p4.b * dx * dy)
    };
}

// 增強智能裁切
function enhancedSmartCrop(imageData, margin = 0.05) {
    const { canvas, width, height } = imageData;
    
    // 分析內容分佈來找到更好的裁切區域
    const contentBounds = analyzeContentBounds(canvas);
    
    let cropX, cropY, cropWidth, cropHeight;
    
    if (contentBounds) {
        // 使用內容分析結果
        const paddingX = Math.floor(width * margin);
        const paddingY = Math.floor(height * margin);
        
        cropX = Math.max(0, contentBounds.minX - paddingX);
        cropY = Math.max(0, contentBounds.minY - paddingY);
        cropWidth = Math.min(width - cropX, contentBounds.maxX - cropX + paddingX);
        cropHeight = Math.min(height - cropY, contentBounds.maxY - cropY + paddingY);
    } else {
        // 備用方案：使用固定邊界
        cropX = Math.floor(width * margin);
        cropY = Math.floor(height * margin);
        cropWidth = Math.floor(width * (1 - 2 * margin));
        cropHeight = Math.floor(height * (1 - 2 * margin));
    }
    
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const ctx = croppedCanvas.getContext('2d');
    
    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cropWidth, cropHeight);
    
    // 裁切圖像
    ctx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    console.log(`智能裁切: (${cropX}, ${cropY}) 尺寸: ${cropWidth}x${cropHeight}`);
    
    return {
        canvas: croppedCanvas,
        width: cropWidth,
        height: cropHeight
    };
}

// 分析內容邊界
function analyzeContentBounds(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // 縮小分析尺寸
    const scale = 0.2;
    const smallWidth = Math.floor(width * scale);
    const smallHeight = Math.floor(height * scale);
    
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = smallWidth;
    smallCanvas.height = smallHeight;
    const smallCtx = smallCanvas.getContext('2d');
    
    smallCtx.drawImage(canvas, 0, 0, smallWidth, smallHeight);
    
    const imageData = smallCtx.getImageData(0, 0, smallWidth, smallHeight);
    const data = imageData.data;
    
    // 找到非背景區域
    let minX = smallWidth, maxX = 0, minY = smallHeight, maxY = 0;
    let hasContent = false;
    
    // 計算背景顏色（取四角的平均顏色）
    const bgColor = calculateBackgroundColor(data, smallWidth, smallHeight);
    const threshold = 40; // 顏色差異闾值
    
    for (let y = 0; y < smallHeight; y++) {
        for (let x = 0; x < smallWidth; x++) {
            const idx = (y * smallWidth + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // 計算與背景的差異
            const diff = Math.abs(r - bgColor.r) + Math.abs(g - bgColor.g) + Math.abs(b - bgColor.b);
            
            if (diff > threshold) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                hasContent = true;
            }
        }
    }
    
    if (!hasContent) return null;
    
    // 縮放回原始尺寸
    return {
        minX: Math.floor(minX / scale),
        maxX: Math.floor(maxX / scale),
        minY: Math.floor(minY / scale),
        maxY: Math.floor(maxY / scale)
    };
}

// 計算背景顏色
function calculateBackgroundColor(data, width, height) {
    const corners = [
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: width - 1, y: height - 1 },
        { x: 0, y: height - 1 }
    ];
    
    let totalR = 0, totalG = 0, totalB = 0;
    let count = 0;
    
    // 取四角附近的像素作為背景樣本
    for (const corner of corners) {
        for (let dy = 0; dy < 5 && corner.y + dy < height; dy++) {
            for (let dx = 0; dx < 5 && corner.x + dx < width; dx++) {
                const idx = ((corner.y + dy) * width + (corner.x + dx)) * 4;
                totalR += data[idx];
                totalG += data[idx + 1];
                totalB += data[idx + 2];
                count++;
            }
        }
    }
    
    return {
        r: Math.round(totalR / count),
        g: Math.round(totalG / count),
        b: Math.round(totalB / count)
    };
}

// 影像強化
function fastImageEnhancement(imageData) {
    const { canvas, width, height } = imageData;
    const ctx = canvas.getContext('2d');
    const imageDataObj = ctx.getImageData(0, 0, width, height);
    const data = imageDataObj.data;
    
    // 對比度和亮度調整
    const contrast = 1.3;
    const brightness = 15;
    
    for (let i = 0; i < data.length; i += 4) {
        // RGB 通道調整
        data[i] = Math.min(255, Math.max(0, data[i] * contrast + brightness));         // R
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * contrast + brightness)); // G
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * contrast + brightness)); // B
    }
    
    ctx.putImageData(imageDataObj, 0, 0);
    
    return {
        canvas: canvas,
        width: width,
        height: height
    };
}

// 轉換為灰階
function convertToGrayscale(imageData) {
    const { canvas, width, height } = imageData;
    const ctx = canvas.getContext('2d');
    const imageDataObj = ctx.getImageData(0, 0, width, height);
    const data = imageDataObj.data;
    
    // 轉換為灰階使用標準公式
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // 使用加權平均法轉為灰階
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
        // data[i + 3] 保持原 alpha 值
    }
    
    ctx.putImageData(imageDataObj, 0, 0);
    
    return {
        canvas: canvas,
        width: width,
        height: height
    };
}

// 顯示處理區域
function showProcessingSection() {
    processingSection.style.display = 'block';
    resultsSection.style.display = 'none';
}

// 更新進度
function updateProgress(percentage, status) {
    if (percentage !== null) {
        progressFill.style.width = percentage + '%';
    }
    statusText.textContent = status;
}

// 顯示結果
function showResults() {
    const validImages = processedImages.filter(img => img !== null);
    
    if (validImages.length === 0) {
        console.error('沒有成功處理的圖片可顯示');
        return;
    }
    
    processingSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    // 顯示第一張成功處理的圖片
    const firstImage = validImages[0];
    displayImageComparison(firstImage);
    
    // 確保下載按鈕可用
    downloadBtn.disabled = false;
}

// 顯示圖片比較
function displayImageComparison(imageData) {
    try {
        const { original, processed } = imageData;
        
        // 設定合理的顯示尺寸
        const maxDisplaySize = 400;
        
        // 顯示原始圖片
        const originalRatio = Math.min(maxDisplaySize / original.width, maxDisplaySize / original.height);
        originalCanvas.width = original.width * originalRatio;
        originalCanvas.height = original.height * originalRatio;
        
        const originalCtx = originalCanvas.getContext('2d');
        originalCtx.drawImage(original.canvas, 0, 0, originalCanvas.width, originalCanvas.height);
        
        // 顯示處理後圖片
        const processedRatio = Math.min(maxDisplaySize / processed.width, maxDisplaySize / processed.height);
        processedCanvas.width = processed.width * processedRatio;
        processedCanvas.height = processed.height * processedRatio;
        
        const processedCtx = processedCanvas.getContext('2d');
        processedCtx.drawImage(processed.canvas, 0, 0, processedCanvas.width, processedCanvas.height);
        
    } catch (error) {
        console.error('顯示圖片時發生錯誤:', error);
    }
}

// 下載處理後的圖片
function downloadProcessedImage() {
    const validImages = processedImages.filter(img => img !== null);
    
    if (validImages.length === 0) {
        alert('沒有可下載的處理結果');
        return;
    }
    
    validImages.forEach((imageData) => {
        const { processed, filename } = imageData;
        
        // 產生新檔名
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        const newFilename = nameWithoutExt + '_update.jpg';
        
        // 轉換為 blob 並下載
        processed.canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = newFilename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }, 'image/jpeg', 0.9);
    });
}

// 重置應用程式
function resetApplication() {
    currentFiles = [];
    processedImages = [];
    selectedFiles.style.display = 'none';
    processingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    fileInput.value = '';
    fileList.innerHTML = '';
    progressFill.style.width = '0%';
    statusText.textContent = '';
    processBtn.disabled = false;
}