import { useEffect, useRef, useState } from 'react';
import { driver } from 'driver.js';
import type { PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import '@/components/library/onboarding/tour.css';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { TOUR_STEPS } from '@/components/library/onboarding/tourSteps';

/**
 * Controller component that mounts driver.js whenever the hook says to.
 * Renders no visible UI itself apart from an in-popover exit confirm
 * when the user clicks outside the popover. Handles responsive popover
 * sizing so the tour works on both Android (narrow Capacitor WebView)
 * and desktop.
 *
 * The driver instance is registered with the hook via setDriverRef so
 * LibraryView's demo handlers (startDemoImport / applyDemoImport) can
 * call driver.moveNext() to advance the tour when the demo dialog opens
 * or the fake book card renders.
 */
export function OnboardingTour() {
  const {
    isOpen,
    stop,
    setDriverRef,
    endDemo,
    startDemoImport,
    applyDemoImport,
    currentStep,
    setCurrentStep,
  } = useOnboardingTour();

  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // Mirror the latest currentStep in a ref so the driver callbacks
  // (constructed once per `isOpen` cycle) always see the freshest
  // value without re-running the effect on every step transition.
  const currentStepRef = useRef<string | null>(currentStep);
  currentStepRef.current = currentStep;
  // Mirror exitConfirmOpen so onPopoverRender (constructed once when the
  // driver mounts) always sees the latest value without re-running the
  // driver effect.
  const exitConfirmOpenRef = useRef(false);
  exitConfirmOpenRef.current = exitConfirmOpen;

  useEffect(() => {
    if (!isOpen) return;

    const d = driver({
      animate: false,
      allowClose: true,
      overlayOpacity: 0.5,
      stagePadding: 8,
      stageRadius: 8,
      showProgress: true,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      progressText: '{{current}} of {{total}}',
      allowKeyboardControl: true,
      skipMissingElement: false,
      overlayClickBehavior: () => {
        // While the demo dialog is up (steps 3 or 4), ignore overlay
        // clicks so the user can interact with the dialog body. The
        // ref mirror keeps the closure fresh without re-running the
        // driver effect on every step transition.
        const step = currentStepRef.current;
        if (step === 'dialog-metadata' || step === 'dialog-shelf') return;
        setExitConfirmOpen(true);
      },
      onNextClick: (_element, step, opts) => {
        const stepId = (step as { data?: { stepId?: string } }).data?.stepId;
        if (stepId === 'import') {
          // Open the demo dialog. The dialog mount is asynchronous
          // (Radix portal + state updates), so defer the advance until
          // after the dialog's data-tour anchor is in the DOM.
          startDemoImport();
          setTimeout(() => opts?.driver?.moveNext(), 150);
          return;
        }
        if (stepId === 'dialog-metadata') {
          // Stay in the dialog — just advance to step 4.
          opts?.driver?.moveNext();
          return;
        }
        if (stepId === 'dialog-shelf') {
          // Close the dialog and reveal the fake book card. Defer so the
          // demo card's data-tour anchor renders before the next step
          // tries to spotlight it.
          applyDemoImport(null, []);
          setTimeout(() => opts?.driver?.moveNext(), 100);
          return;
        }
        if (stepId === 'book-card') {
          // No state change needed. The next step highlights the menu
          // trigger button directly; LibraryView does not need to open
          // the menu.
          opts?.driver?.moveNext();
          return;
        }
        opts?.driver?.moveNext();
      },
      onPrevClick: (_element, step, opts) => {
        // Reverse the demo state created when moving forward from the
        // current step. driver.js's previousStep is historical state, not
        // the destination of this Back click, so key this off the active
        // step supplied to the callback instead.
        const current = (step as { data?: { stepId?: string } }).data?.stepId;
        if (current === 'book-card') {
          // Replace the fake card with the demo dialog before step 4 tries
          // to spotlight the shelf and labels section.
          startDemoImport();
          setTimeout(() => opts?.driver?.movePrevious(), 100);
          return;
        }
        if (current === 'dialog-metadata') {
          // Close the demo dialog before returning to the import button.
          endDemo();
          setTimeout(() => opts?.driver?.movePrevious(), 50);
          return;
        }
        opts?.driver?.movePrevious();
      },
      steps: TOUR_STEPS.map(step => ({
        element: step.targetSelector as string | Element | (() => Element),
        popover: {
          title: step.title,
          description: step.body,
          side: step.side,
          align: step.align,
        },
        data: { stepId: step.id },
        waitForElement: step.waitForElement,
      })),
      onHighlightStarted: (_element, step) => {
        const stepId = (step as { data?: { stepId?: string } } | undefined)?.data?.stepId;
        currentStepRef.current = stepId ?? null;
        setCurrentStep(stepId ?? null);
        const wrapper = document.querySelector('.driver-popover');
        if (wrapper && stepId) wrapper.setAttribute('data-tour-step', stepId);
      },
      onHighlighted: (_element, step) => {
        const stepId = (step as { data?: { stepId?: string } } | undefined)?.data?.stepId;
        if (stepId === 'welcome') {
          // Hide the visible spotlight dot for the welcome step. Driver.js
          // creates a 0x0 dummy element at center; with stagePadding the
          // SVG path draws a small visible rectangle. We replace the path
          // with one that has no inner cutout so the overlay is solid.
          const svg = document.querySelector('svg.driver-overlay path');
          if (svg) {
            const w = window.innerWidth;
            const h = window.innerHeight;
            svg.setAttribute('d', `M${w},0L0,0L0,${h}L${w},${h}L${w},0Z`);
          }
        }
      },
      onPopoverRender: (popover: PopoverDOM) => {
        applyResponsiveStyles(popover);

        const stepId = currentStepRef.current;
        if (stepId) popover.wrapper.setAttribute('data-tour-step', stepId);

        if (exitConfirmOpenRef.current) {
          // Swap the existing popover elements to become the exit
          // confirm view. Same CSS, same buttons, just different text.
          // Save originals so we can restore when Stay is clicked.
          if (!popover.wrapper.hasAttribute('data-tour-exit-active')) {
            popover.wrapper.setAttribute('data-tour-exit-active', '');
            popover.wrapper.dataset.origTitle = popover.title.textContent ?? '';
            popover.wrapper.dataset.origDesc = popover.description.textContent ?? '';
            popover.wrapper.dataset.origNextText = popover.nextButton.textContent ?? '';
            popover.wrapper.dataset.origPrevDisplay = popover.previousButton.style.display;
            popover.wrapper.dataset.origProgressDisplay = popover.progress.style.display;
            popover.wrapper.dataset.origCloseDisplay = popover.closeButton.style.display;
          }

          popover.title.textContent = 'End the tour?';
          popover.description.textContent = 'You can replay it any time from the About page.';
          popover.closeButton.style.display = 'none';

          // Hide Back and progress. Repurpose Next as "End tour" and
          // add a "Stay" button before it.
          popover.previousButton.style.display = 'none';
          popover.progress.style.display = 'none';
          popover.nextButton.textContent = 'End tour';

          if (!popover.footerButtons.querySelector('[data-tour-stay]')) {
            const stay = document.createElement('button');
            stay.setAttribute('data-tour-stay', '');
            stay.type = 'button';
            stay.textContent = 'Stay on tour';
            stay.className = 'driver-popover-footer-btn tour-stay-btn';
            stay.style.display = '';
            stay.onclick = event => {
              event.preventDefault();
              event.stopPropagation();
              setExitConfirmOpen(false);
            };
            popover.footerButtons.insertBefore(stay, popover.nextButton);
          }

          // Override Next to end the tour instead of advancing.
          popover.nextButton.onclick = () => {
            setExitConfirmOpen(false);
            driverRef.current?.destroy();
          };
        } else if (popover.wrapper.hasAttribute('data-tour-exit-active')) {
          // Normal step: restore elements that were swapped for the
          // exit confirm view.
          const saved = popover.wrapper.dataset;
          popover.closeButton.style.display = saved.origCloseDisplay ?? '';
          popover.previousButton.style.display = saved.origPrevDisplay ?? '';
          popover.progress.style.display = saved.origProgressDisplay ?? '';
          popover.wrapper.removeAttribute('data-tour-exit-active');

          // Restore title and description text.
          popover.title.textContent = saved.origTitle ?? '';
          popover.description.textContent = saved.origDesc ?? '';
          popover.nextButton.textContent = saved.origNextText ?? '';
          popover.nextButton.onclick = null;
          delete saved.origTitle;
          delete saved.origDesc;
          delete saved.origNextText;
          delete saved.origPrevDisplay;
          delete saved.origProgressDisplay;
          delete saved.origCloseDisplay;

          // Remove the injected Stay button.
          const stayBtn = popover.footerButtons.querySelector('[data-tour-stay]');
          if (stayBtn) stayBtn.remove();
        }

        // Bullet rendering for steps with sentinel bodies. Only on normal
        // steps (exit confirm hides the description anyway).
        if (!exitConfirmOpenRef.current) {
          const desc = popover.description;
          const sentinelBody = desc.textContent ?? '';
          const bulletMatch = sentinelBody.match(/^([A-Z_]+)\|(.*)$/s);
          if (bulletMatch) {
            const heading = bulletMatch[1];
            const bullets = bulletMatch[2].split('|').filter(Boolean);
            const headingMap: Record<string, string> = {
              SORT_SEARCH_MANAGE_LIBRARY: 'Sort, Search, and Manage Library live in the top bar. The header also has:',
              ADD_BOOK_INTRO: 'From your library you can add a new book. Tap the plus button and browse to a file. Supported formats:',
            };
            desc.textContent = '';
            const h = document.createElement('p');
            h.className = 'text-sm font-medium mb-2';
            h.textContent = headingMap[heading] ?? heading;
            const list = document.createElement('ul');
            list.className = 'list-disc pl-5 space-y-1 text-sm text-muted-foreground';
            for (const text of bullets) {
              const li = document.createElement('li');
              li.textContent = text;
              list.appendChild(li);
            }
            desc.appendChild(h);
            desc.appendChild(list);
          }
        }

        // Move the progress text into the buttons container so the
        // footer renders as a single row.
        if (!exitConfirmOpenRef.current
            && popover.progress.parentElement !== popover.footerButtons) {
          popover.footerButtons.insertBefore(
            popover.progress,
            popover.nextButton,
          );
        }
      },
      onDestroyStarted: () => {
        // Persist completion and tear down any demo UI as soon as the
        // user closes / skips / finishes the tour.
        endDemo();
        setCurrentStep(null);
        setExitConfirmOpen(false);
        stop();
      },
    });

    driverRef.current = d;
    setDriverRef(d);
    d.drive();

    return () => {
      setDriverRef(null);
      driverRef.current = null;
      setCurrentStep(null);
      d.destroy();
    };
  }, [isOpen, stop, setDriverRef, endDemo, startDemoImport, applyDemoImport, setCurrentStep]);

  // When the exit confirm toggles, re-highlight the current step so
  // onPopoverRender re-runs and updates the popover DOM.
  useEffect(() => {
    if (!isOpen) return;
    const currentStepData = driverRef.current?.getActiveStep();
    if (currentStepData) driverRef.current?.highlight(currentStepData);
  }, [exitConfirmOpen, isOpen]);

  if (!isOpen) return null;
  return null;
}

/**
 * Sizes the popover wrapper for the current viewport. Re-runs every step
 * transition and on window resize (driver.js fires onPopoverRender again
 * automatically). Per-step mobile positioning lives in tour.css.
 */
function applyResponsiveStyles(popover: PopoverDOM): void {
  const wrapper = popover.wrapper;

  const isMobile = typeof window !== 'undefined'
    && window.matchMedia('(max-width: 640px)').matches;

  // Width and padding are handled in tour.css (mobile media query keeps
  // the popover edge-to-edge with a small gutter). We only need to
  // override the inline styles driver.js sets so the desktop path has
  // consistent max-width and padding.
  if (!isMobile) {
    wrapper.style.maxWidth = '360px';
    wrapper.style.padding = '20px';
  }
}