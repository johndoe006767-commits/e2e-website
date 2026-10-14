// Keep the original dependency document isolated from the explorer's selectors.
// Size it to its content so the merged page has one continuous scroll surface.
const dependencyFrame = document.querySelector('#dependency-frame');
dependencyFrame.addEventListener('load', () => {
  const content = dependencyFrame.contentDocument;
  const main = content.querySelector('main');
  const resize = () => {
    dependencyFrame.style.height = `${Math.ceil(main.getBoundingClientRect().height) + 2}px`;
  };
  new ResizeObserver(resize).observe(main);
  resize();
});

document.addEventListener('keydown', () => document.body.classList.add('keyboard-nav'));
document.addEventListener('pointerdown', () => document.body.classList.remove('keyboard-nav'));
