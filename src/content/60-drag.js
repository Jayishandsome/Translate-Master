  // ----------------------------------------------------------------------
  // 拖拉 (位置一律使用 fixed 座標，避免 scroll 問題)
  // ----------------------------------------------------------------------
  let drag = null;

  function clampToViewport(left, top) {
    const rect = pop.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    return {
      left: Math.max(8, Math.min(left, maxLeft)),
      top: Math.max(8, Math.min(top, maxTop)),
    };
  }

  function onDragMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const x = e.clientX - drag.offsetX;
    const y = e.clientY - drag.offsetY;
    const { left, top } = clampToViewport(x, y);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.style.right = "auto";
    pop.style.bottom = "auto";
  }

  function onDragEnd(e) {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    const pointerId = drag.pointerId;
    drag = null;
    if (handle.hasPointerCapture?.(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
  }

  function onDragStart(e) {
    // 點到關閉/複製按鈕時不啟動拖拉
    if (drag || e.button !== 0 || e.target.closest(".ctx-icon-btn")) return;
    const rect = pop.getBoundingClientRect();
    drag = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  handle.addEventListener("pointerdown", onDragStart);
  handle.addEventListener("pointermove", onDragMove);
  handle.addEventListener("pointerup", onDragEnd);
  handle.addEventListener("pointercancel", onDragEnd);
  handle.addEventListener("lostpointercapture", onDragEnd);
