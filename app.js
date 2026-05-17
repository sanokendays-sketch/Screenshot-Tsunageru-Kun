(function () {
  "use strict";

  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  const presets = {
    auto: null,
    note: { width: 1280, height: 670 },
    x: { width: 1200, height: 675 },
    instagramSquare: { width: 1080, height: 1080 },
    instagramPortrait: { width: 1080, height: 1350 },
    story: { width: 1080, height: 1920 },
    ogp: { width: 1200, height: 630 },
    youtube: { width: 1280, height: 720 },
    pinterest: { width: 1000, height: 1500 }
  };

  const state = {
    images: [],
    isRendering: false,
    renderTimer: 0,
    lastBlob: null
  };

  const elements = {
    input: document.getElementById("imageInput"),
    dropZone: document.getElementById("dropZone"),
    imageList: document.getElementById("imageList"),
    emptyState: document.getElementById("emptyState"),
    message: document.getElementById("message"),
    canvas: document.getElementById("previewCanvas"),
    saveButton: document.getElementById("saveButton"),
    shareButton: document.getElementById("shareButton"),
    outerPadding: document.getElementById("outerPadding"),
    gap: document.getElementById("gap"),
    radius: document.getElementById("radius"),
    scale: document.getElementById("scale"),
    markerSize: document.getElementById("markerSize"),
    shadow: document.getElementById("shadow"),
    alignSize: document.getElementById("alignSize"),
    sizePreset: document.getElementById("sizePreset"),
    customWidth: document.getElementById("customWidth"),
    customHeight: document.getElementById("customHeight"),
    sizeMode: document.querySelector(".size-mode"),
    outerPaddingValue: document.getElementById("outerPaddingValue"),
    gapValue: document.getElementById("gapValue"),
    radiusValue: document.getElementById("radiusValue"),
    scaleValue: document.getElementById("scaleValue"),
    markerSizeValue: document.getElementById("markerSizeValue")
  };

  const ctx = elements.canvas.getContext("2d");

  function showMessage(text, isError) {
    elements.message.textContent = text || "";
    elements.message.classList.toggle("is-error", Boolean(isError));
  }

  function getOption(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : "";
  }

  function getSettings() {
    return {
      layout: getOption("layout") || "vertical",
      marker: getOption("marker") || "arrow",
      arrowStyle: getOption("arrowStyle") || "simple",
      background: getOption("background") || "#f6eddc",
      outerPadding: Number(elements.outerPadding.value),
      gap: Number(elements.gap.value),
      radius: Number(elements.radius.value),
      scale: Number(elements.scale.value) / 100,
      markerSize: Number(elements.markerSize.value) / 100,
      markerColor: getOption("markerColor") || "#77813d",
      shadow: elements.shadow.checked,
      alignSize: elements.alignSize.checked,
      sizePreset: elements.sizePreset.value,
      customWidth: Number(elements.customWidth.value) || 1200,
      customHeight: Number(elements.customHeight.value) || 900
    };
  }

  function updateRangeLabels() {
    elements.outerPaddingValue.textContent = `${elements.outerPadding.value}px`;
    elements.gapValue.textContent = `${elements.gap.value}px`;
    elements.radiusValue.textContent = `${elements.radius.value}px`;
    elements.scaleValue.textContent = `${elements.scale.value}%`;
    elements.markerSizeValue.textContent = `${elements.markerSize.value}%`;
  }

  function supportsFile(file) {
    return allowedTypes.includes(file.type);
  }

  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!supportsFile(file)) {
        reject(new Error("この形式にはまだ対応していません"));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          resolve({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            file,
            name: file.name || "貼り付け画像",
            src: reader.result,
            image,
            width: image.naturalWidth,
            height: image.naturalHeight,
            label: ""
          });
        };
        image.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) {
      showMessage("画像ファイルをえらんでください", true);
      return;
    }

    let added = 0;
    let lastError = "";

    for (const file of files) {
      try {
        const item = await loadImageFile(file);
        state.images.push(item);
        added += 1;
      } catch (error) {
        lastError = error.message || "画像の読み込みに失敗しました";
      }
    }

    renderImageList();
    scheduleRender();

    if (added && lastError) {
      showMessage(`${added}枚を追加しました。一部の画像は読み込めませんでした。`, true);
    } else if (added) {
      showMessage(`${added}枚の画像を追加しました`, false);
    } else {
      showMessage(lastError || "画像の読み込みに失敗しました", true);
    }
  }

  function renderImageList() {
    elements.imageList.innerHTML = "";
    elements.emptyState.style.display = state.images.length ? "none" : "block";
    elements.saveButton.disabled = !state.images.length;
    elements.shareButton.disabled = !state.images.length;

    state.images.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "image-item";
      li.draggable = true;
      li.dataset.id = item.id;

      const thumb = document.createElement("img");
      thumb.className = "thumb";
      thumb.src = item.src;
      thumb.alt = `${index + 1}枚目のサムネイル`;

      const meta = document.createElement("div");
      meta.className = "image-meta";

      const title = document.createElement("strong");
      title.textContent = `${index + 1}枚目`;

      const size = document.createElement("small");
      size.textContent = `${item.width} × ${item.height}px`;

      const label = document.createElement("input");
      label.type = "text";
      label.maxLength = 40;
      label.placeholder = "ラベル（例：入力画面）";
      label.value = item.label;
      label.addEventListener("input", () => {
        item.label = label.value;
        scheduleRender();
      });

      meta.append(title, size, label);

      const actions = document.createElement("div");
      actions.className = "item-actions";
      actions.append(
        makeItemButton("上へ", index === 0, () => moveImage(index, -1)),
        makeItemButton("下へ", index === state.images.length - 1, () => moveImage(index, 1)),
        makeItemButton("削除", false, () => removeImage(index))
      );

      li.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
      });
      li.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      li.addEventListener("drop", (event) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData("text/plain");
        reorderByDrag(draggedId, item.id);
      });

      li.append(thumb, meta, actions);
      elements.imageList.appendChild(li);
    });
  }

  function makeItemButton(text, disabled, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
  }

  function moveImage(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.images.length) return;
    const [item] = state.images.splice(index, 1);
    state.images.splice(nextIndex, 0, item);
    renderImageList();
    scheduleRender();
  }

  function removeImage(index) {
    state.images.splice(index, 1);
    renderImageList();
    scheduleRender();
    showMessage(state.images.length ? "画像を削除しました" : "画像がなくなりました", false);
  }

  function reorderByDrag(draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return;
    const from = state.images.findIndex((item) => item.id === draggedId);
    const to = state.images.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = state.images.splice(from, 1);
    state.images.splice(to, 0, item);
    renderImageList();
    scheduleRender();
  }

  function scheduleRender() {
    clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(renderPreview, 70);
  }

  function getPreparedItems(settings) {
    if (!state.images.length) return [];

    const baseScale = settings.scale;
    const items = state.images.map((item) => ({
      source: item,
      label: item.label.trim(),
      width: item.width * baseScale,
      height: item.height * baseScale
    }));

    if (!settings.alignSize || items.length === 1) return items;

    if (settings.layout === "vertical") {
      const targetWidth = Math.min(...items.map((item) => item.width));
      return items.map((item) => ({
        ...item,
        width: targetWidth,
        height: targetWidth * (item.source.height / item.source.width)
      }));
    }

    if (settings.layout === "horizontal") {
      const targetHeight = Math.min(...items.map((item) => item.height));
      return items.map((item) => ({
        ...item,
        height: targetHeight,
        width: targetHeight * (item.source.width / item.source.height)
      }));
    }

    const targetWidth = Math.min(...items.map((item) => item.width));
    return items.map((item) => ({
      ...item,
      width: targetWidth,
      height: targetWidth * (item.source.height / item.source.width)
    }));
  }

  function hasNumbers(settings) {
    return settings.marker === "number" || settings.marker === "both" || (settings.layout === "grid" && settings.marker !== "none");
  }

  function hasArrows(settings) {
    return (settings.marker === "arrow" || settings.marker === "both") && settings.layout !== "grid";
  }

  function labelHeight(item) {
    return item.label ? 38 : 0;
  }

  function measureAutoLayout(items, settings) {
    const outer = settings.outerPadding;
    const gap = settings.gap;

    if (!items.length) {
      return { width: 900, height: 520, items: [] };
    }

    if (settings.layout === "horizontal") {
      const contentWidth = items.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, items.length - 1);
      const contentHeight = Math.max(...items.map((item) => item.height + labelHeight(item)));
      return { width: Math.ceil(contentWidth + outer * 2), height: Math.ceil(contentHeight + outer * 2) };
    }

    if (settings.layout === "grid") {
      const columns = 2;
      const rows = Math.ceil(items.length / columns);
      const cellWidth = Math.max(...items.map((item) => item.width));
      const cellHeight = Math.max(...items.map((item) => item.height + labelHeight(item)));
      return {
        width: Math.ceil(cellWidth * columns + gap * (columns - 1) + outer * 2),
        height: Math.ceil(cellHeight * rows + gap * Math.max(0, rows - 1) + outer * 2)
      };
    }

    const contentWidth = Math.max(...items.map((item) => item.width));
    const contentHeight = items.reduce((sum, item) => sum + item.height + labelHeight(item), 0) + gap * Math.max(0, items.length - 1);
    return { width: Math.ceil(contentWidth + outer * 2), height: Math.ceil(contentHeight + outer * 2) };
  }

  function getCanvasSize(items, settings) {
    if (settings.sizePreset === "custom") {
      return {
        width: clamp(settings.customWidth, 320, 4000),
        height: clamp(settings.customHeight, 320, 4000)
      };
    }

    const preset = presets[settings.sizePreset];
    if (preset) return preset;
    return measureAutoLayout(items, settings);
  }

  function fitItemsToCanvas(items, settings, canvasSize) {
    if (settings.sizePreset === "auto" || !items.length) return items;
    const auto = measureAutoLayout(items, settings);
    const fitScale = Math.min(canvasSize.width / auto.width, canvasSize.height / auto.height, 1);
    return items.map((item) => ({
      ...item,
      width: item.width * fitScale,
      height: item.height * fitScale
    }));
  }

  function getPositions(items, settings, canvasSize) {
    const gap = settings.gap;
    const outer = settings.outerPadding;
    const positions = [];

    if (!items.length) return positions;

    if (settings.layout === "horizontal") {
      const totalWidth = items.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, items.length - 1);
      const maxHeight = Math.max(...items.map((item) => item.height + labelHeight(item)));
      let x = centeredStart(canvasSize.width, totalWidth, outer);
      const yBase = centeredStart(canvasSize.height, maxHeight, outer);
      items.forEach((item) => {
        positions.push({
          x,
          y: yBase + (maxHeight - labelHeight(item) - item.height) / 2,
          width: item.width,
          height: item.height
        });
        x += item.width + gap;
      });
      return positions;
    }

    if (settings.layout === "grid") {
      const columns = 2;
      const rows = Math.ceil(items.length / columns);
      const cellWidth = Math.max(...items.map((item) => item.width));
      const cellHeight = Math.max(...items.map((item) => item.height + labelHeight(item)));
      const totalWidth = cellWidth * columns + gap;
      const totalHeight = cellHeight * rows + gap * Math.max(0, rows - 1);
      const startX = centeredStart(canvasSize.width, totalWidth, outer);
      const startY = centeredStart(canvasSize.height, totalHeight, outer);
      items.forEach((item, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        positions.push({
          x: startX + column * (cellWidth + gap) + (cellWidth - item.width) / 2,
          y: startY + row * (cellHeight + gap),
          width: item.width,
          height: item.height
        });
      });
      return positions;
    }

    const contentWidth = Math.max(...items.map((item) => item.width));
    const totalHeight = items.reduce((sum, item) => sum + item.height + labelHeight(item), 0) + gap * Math.max(0, items.length - 1);
    let y = centeredStart(canvasSize.height, totalHeight, outer);
    const startX = centeredStart(canvasSize.width, contentWidth, outer);
    items.forEach((item) => {
      positions.push({
        x: startX + (contentWidth - item.width) / 2,
        y,
        width: item.width,
        height: item.height
      });
      y += item.height + labelHeight(item) + gap;
    });
    return positions;
  }

  function centeredStart(canvasLength, contentLength, outer) {
    return Math.max(outer, (canvasLength - contentLength) / 2);
  }

  function drawPreviewPlaceholder() {
    const width = elements.canvas.width;
    const height = elements.canvas.height;
    ctx.fillStyle = "#f6eddc";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#77813d";
    ctx.font = "700 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("スクショを入れるとここに表示されます", width / 2, height / 2);
  }

  async function renderPreview() {
    if (state.isRendering) return;
    state.isRendering = true;

    try {
      updateRangeLabels();
      elements.sizeMode.classList.toggle("is-custom", elements.sizePreset.value === "custom");

      if (!state.images.length) {
        elements.canvas.width = 900;
        elements.canvas.height = 520;
        drawPreviewPlaceholder();
        state.lastBlob = null;
        state.isRendering = false;
        return;
      }

      const settings = getSettings();
      const prepared = getPreparedItems(settings);
      const canvasSize = getCanvasSize(prepared, settings);
      const fitted = fitItemsToCanvas(prepared, settings, canvasSize);
      const positions = getPositions(fitted, settings, canvasSize);

      elements.canvas.width = canvasSize.width;
      elements.canvas.height = canvasSize.height;

      drawOutput(ctx, fitted, positions, settings, canvasSize);
      state.lastBlob = await canvasToBlob(elements.canvas);
    } catch (error) {
      console.error(error);
      showMessage("保存用画像の生成に失敗しました", true);
      drawPreviewPlaceholder();
    } finally {
      state.isRendering = false;
    }
  }

  function drawOutput(context, items, positions, settings, canvasSize) {
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
    context.fillStyle = settings.background;
    context.fillRect(0, 0, canvasSize.width, canvasSize.height);

    items.forEach((item, index) => {
      const box = positions[index];
      drawImageCard(context, item, box, settings);
      if (hasNumbers(settings)) {
        drawNumberBadge(context, index + 1, box, canvasSize, settings);
      }
      if (item.label) {
        drawLabel(context, item.label, box, canvasSize);
      }
    });

    if (hasArrows(settings)) {
      drawArrows(context, positions, settings, canvasSize);
    }
  }

  function drawImageCard(context, item, box, settings) {
    context.save();
    if (settings.shadow) {
      context.shadowColor = "rgba(58, 45, 29, 0.22)";
      context.shadowBlur = 18;
      context.shadowOffsetY = 8;
      context.shadowOffsetX = 0;
    }
    roundedRectPath(context, box.x, box.y, box.width, box.height, Math.min(settings.radius, box.width / 2, box.height / 2));
    context.fillStyle = "#ffffff";
    context.fill();
    context.restore();

    context.save();
    roundedRectPath(context, box.x, box.y, box.width, box.height, Math.min(settings.radius, box.width / 2, box.height / 2));
    context.clip();
    context.drawImage(item.source.image, box.x, box.y, box.width, box.height);
    context.restore();
  }

  function drawArrows(context, positions, settings, canvasSize) {
    for (let index = 0; index < positions.length - 1; index += 1) {
      const current = positions[index];
      const next = positions[index + 1];
      if (settings.layout === "horizontal") {
        const x = (current.x + current.width + next.x) / 2;
        const y = Math.min(canvasSize.height - 20, Math.max(20, current.y + current.height / 2));
        drawArrowSymbol(context, x, y, "right", settings, canvasSize);
      } else {
        const x = current.x + current.width / 2;
        const y = (current.y + current.height + next.y) / 2;
        drawArrowSymbol(context, x, y, "down", settings, canvasSize);
      }
    }
  }

  function drawArrowSymbol(context, x, y, direction, settings, canvasSize) {
    const baseSize = Math.max(34, Math.min(canvasSize.width, canvasSize.height) * 0.055) * settings.markerSize;
    const arrowText = direction === "right" ? "→" : "↓";

    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";

    if (settings.arrowStyle === "soft") {
      const width = direction === "right" ? baseSize * 1.82 : baseSize * 1.36;
      const height = baseSize * 1.18;
      roundedRectPath(context, x - width / 2, y - height / 2, width, height, height / 2);
      context.fillStyle = hexToRgba(settings.markerColor, 0.12);
      context.fill();
      context.strokeStyle = hexToRgba(settings.markerColor, 0.48);
      context.lineWidth = Math.max(2, baseSize * 0.055);
      context.stroke();
      context.fillStyle = settings.markerColor;
      context.font = `900 ${baseSize * 0.82}px sans-serif`;
      context.fillText(arrowText, x, y - baseSize * 0.02);
    } else if (settings.arrowStyle === "bold") {
      drawBoldArrow(context, x, y, direction, baseSize, settings.markerColor);
    } else if (settings.arrowStyle === "label") {
      const width = direction === "right" ? baseSize * 2.2 : baseSize * 1.58;
      const height = baseSize * 1.26;
      const notch = Math.min(baseSize * 0.34, width * 0.2);
      context.beginPath();
      if (direction === "right") {
        context.moveTo(x - width / 2, y - height / 2);
        context.lineTo(x + width / 2 - notch, y - height / 2);
        context.lineTo(x + width / 2, y);
        context.lineTo(x + width / 2 - notch, y + height / 2);
        context.lineTo(x - width / 2, y + height / 2);
        context.quadraticCurveTo(x - width / 2 - notch * 0.18, y, x - width / 2, y - height / 2);
      } else {
        context.moveTo(x - width / 2, y - height / 2);
        context.lineTo(x + width / 2, y - height / 2);
        context.lineTo(x + width / 2, y + height / 2 - notch);
        context.lineTo(x, y + height / 2);
        context.lineTo(x - width / 2, y + height / 2 - notch);
        context.quadraticCurveTo(x, y - height / 2 - notch * 0.18, x - width / 2, y - height / 2);
      }
      context.closePath();
      context.fillStyle = settings.markerColor;
      context.fill();
      context.fillStyle = "#ffffff";
      context.font = `900 ${baseSize * 0.62}px sans-serif`;
      context.fillText(arrowText, x, y - baseSize * 0.01);
    } else {
      context.fillStyle = settings.markerColor;
      context.font = `900 ${baseSize}px sans-serif`;
      context.fillText(arrowText, x, y);
    }

    context.restore();
  }

  function drawBoldArrow(context, x, y, direction, size, color) {
    const length = size * 1.65;
    const lineWidth = Math.max(8, size * 0.2);
    const headLength = size * 0.5;
    const headWidth = size * 0.64;
    const startX = direction === "right" ? x - length / 2 : x;
    const startY = direction === "right" ? y : y - length / 2;
    const endX = direction === "right" ? x + length / 2 - headLength * 0.5 : x;
    const endY = direction === "right" ? y : y + length / 2 - headLength * 0.5;

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = hexToRgba(color, 0.22);
    context.lineWidth = lineWidth * 1.8;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();

    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();

    context.fillStyle = color;
    context.beginPath();
    if (direction === "right") {
      context.moveTo(x + length / 2, y);
      context.lineTo(x + length / 2 - headLength, y - headWidth / 2);
      context.lineTo(x + length / 2 - headLength * 0.72, y);
      context.lineTo(x + length / 2 - headLength, y + headWidth / 2);
    } else {
      context.moveTo(x, y + length / 2);
      context.lineTo(x - headWidth / 2, y + length / 2 - headLength);
      context.lineTo(x, y + length / 2 - headLength * 0.72);
      context.lineTo(x + headWidth / 2, y + length / 2 - headLength);
    }
    context.closePath();
    context.fill();
    context.restore();
  }

  function hexToRgba(hex, alpha) {
    const normalized = hex.replace("#", "");
    if (normalized.length !== 6) return `rgba(119, 129, 61, ${alpha})`;
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function drawNumberBadge(context, number, box, canvasSize, settings) {
    const size = Math.max(34, Math.min(58, Math.min(canvasSize.width, canvasSize.height) * 0.055)) * settings.markerSize;
    const x = box.x + Math.max(10, size * 0.25);
    const y = box.y + Math.max(10, size * 0.25);
    const radius = size / 2;

    context.save();
    context.fillStyle = settings.markerColor;
    roundedRectPath(context, x, y, size, size, radius);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = `800 ${size * 0.52}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(number), x + size / 2, y + size / 2 + 1);
    context.restore();
  }

  function drawLabel(context, label, box, canvasSize) {
    const fontSize = Math.max(22, Math.min(34, canvasSize.width * 0.026));
    const y = box.y + box.height + fontSize + 10;
    const lines = wrapText(context, label, box.width * 0.92, fontSize);

    context.save();
    context.fillStyle = "#3f372c";
    context.font = `800 ${fontSize}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillText(lines[0], box.x + box.width / 2, y);
    context.restore();
  }

  function wrapText(context, text, maxWidth, fontSize) {
    context.font = `800 ${fontSize}px sans-serif`;
    if (context.measureText(text).width <= maxWidth) return [text];
    let clipped = text;
    while (clipped.length > 1 && context.measureText(`${clipped}…`).width > maxWidth) {
      clipped = clipped.slice(0, -1);
    }
    return [`${clipped}…`];
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("保存用画像の生成に失敗しました"));
      }, "image/png");
    });
  }

  async function ensureLatestBlob() {
    if (!state.images.length) {
      throw new Error("画像ファイルをえらんでください");
    }
    await renderPreview();
    if (!state.lastBlob) {
      throw new Error("保存用画像の生成に失敗しました");
    }
    return state.lastBlob;
  }

  async function saveImage() {
    try {
      const blob = await ensureLatestBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `screenshot-tsunageru_${timestamp()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showMessage("画像を保存しました", false);
    } catch (error) {
      showMessage(error.message || "保存用画像の生成に失敗しました", true);
    }
  }

  async function shareImage() {
    try {
      const blob = await ensureLatestBlob();
      const file = new File([blob], `screenshot-tsunageru_${timestamp()}.png`, { type: "image/png" });

      if (!navigator.canShare || !navigator.canShare({ files: [file] }) || !navigator.share) {
        showMessage("このブラウザは共有機能に対応していません。画像を保存するをご利用ください。", true);
        return;
      }

      await navigator.share({
        title: "スクショつなげるくん",
        text: "スクショを1枚の説明画像にまとめました。",
        files: [file]
      });
      showMessage("共有を開きました", false);
    } catch (error) {
      if (error.name === "AbortError") return;
      showMessage("シェアに失敗しました", true);
    }
  }

  function timestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return [
      now.getFullYear(),
      "-",
      pad(now.getMonth() + 1),
      "-",
      pad(now.getDate()),
      "T",
      pad(now.getHours()),
      "-",
      pad(now.getMinutes()),
      "-",
      pad(now.getSeconds())
    ].join("");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function bindEvents() {
    elements.input.addEventListener("change", (event) => {
      addFiles(event.target.files);
      event.target.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.add("is-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove("is-over");
      });
    });

    elements.dropZone.addEventListener("drop", (event) => {
      addFiles(event.dataTransfer.files);
    });

    document.addEventListener("paste", (event) => {
      const files = Array.from(event.clipboardData.files || []).filter((file) => file.type.startsWith("image/"));
      if (files.length) addFiles(files);
    });

    document.querySelectorAll("input, select").forEach((control) => {
      if (control === elements.input) return;
      control.addEventListener("input", scheduleRender);
      control.addEventListener("change", scheduleRender);
    });

    elements.saveButton.addEventListener("click", saveImage);
    elements.shareButton.addEventListener("click", shareImage);
  }

  bindEvents();
  updateRangeLabels();
  renderImageList();
  renderPreview();
}());
