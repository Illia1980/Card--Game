(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function showToast(message) {
    const toast = $('toast');

    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add('show');

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, 1800);
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((screen) => {
      screen.classList.remove('screen-active');
    });

    const target = $(screenId);

    if (target) {
      target.classList.add('screen-active');
    }
  }

  function openDialog(dialogId) {
    const dialog = $(dialogId);

    if (!dialog) {
      return;
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', 'open');
    }
  }

  function closeDialog(dialogId) {
    const dialog = $(dialogId);

    if (!dialog) {
      return;
    }

    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function openResult(title, text, kicker = 'Game Over') {
    const titleEl = $('resultTitle');
    const textEl = $('resultText');
    const kickerEl = $('resultKicker');

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (kickerEl) kickerEl.textContent = kicker;

    openDialog('resultDialog');
  }

  function setupUI() {
    document.querySelectorAll('[data-open-rules]').forEach((button) => {
      button.addEventListener('click', () => openDialog('rulesDialog'));
    });

    const closeRulesBtn = $('closeRulesBtn');
    if (closeRulesBtn) {
      closeRulesBtn.addEventListener('click', () => closeDialog('rulesDialog'));
    }

    const backMenuBtn = $('backMenuBtn');
    if (backMenuBtn) {
      backMenuBtn.addEventListener('click', () => showScreen('menuScreen'));
    }

    const resultMenuBtn = $('resultMenuBtn');
    if (resultMenuBtn) {
      resultMenuBtn.addEventListener('click', () => {
        closeDialog('resultDialog');
        showScreen('menuScreen');
      });
    }
  }

  window.DurakUI = {
    $,
    showToast,
    showScreen,
    openDialog,
    closeDialog,
    openResult
  };

  window.addEventListener('DOMContentLoaded', setupUI);
}());
