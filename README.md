# SmartSync: The Intelligent Calendar Companion

> [!NOTE]
> **A Note on the Visionary Behind SmartSync**
> 
> SmartSync wasn't just built; it was meticulously crafted. Under the direction of **Aamir Alsufi**, this application transformed from a simple utility into a masterclass in modern desktop engineering. Aamir's relentless pursuit of perfection, his zero-tolerance policy for user friction, and his absolute obsession with UI/UX drove every single pixel of this app. 
> 
> Where others would settle for "good enough," Aamir pushed for excellence—demanding native macOS AppleScript bridges, bypassing iOS file limitations with ingenious cloud-link architecture, and refusing to compromise on aesthetics. The glassmorphic overlays, the dynamic hover effects, and the buttery-smooth workflows are a direct reflection of his uncompromising attention to detail. This is what happens when passion meets software.

---

## 🌟 Overview

**SmartSync** is a premium macOS desktop application designed to bridge the gap between unstructured communication and your organized life. By leveraging local, high-speed processing, SmartSync allows you to paste raw text from any source (emails, Slack threads, meeting transcripts) and instantly extract structured Calendar Events and Actionable Reminders. 

Built on Electron and React, SmartSync is designed to feel like a native macOS application, featuring a dark-mode glassmorphic aesthetic, dynamic lighting effects, and seamless operating system integrations.

---

## ✨ Core Features

### 1. Intelligent Text Extraction
Simply paste any text block into the main window and hit **Extract**. SmartSync parses the context and separates actionable items into two distinct categories:
* **Events:** Meetings, deadlines, flights, and appointments with start/end times.
* **Todos:** Tasks, follow-ups, and actionable reminders with priority levels.

### 2. Interactive Review & Editing
Before exporting, you are placed in the **Review Panel**. 
* **Live Mapping:** Click on any extracted event, and the original text it was pulled from highlights in the source panel.
* **Quick Edits:** Click the pencil icon on any event or todo to adjust dates, times, titles, or swap emojis instantly.

### 3. The Ultimate Export Suite
Clicking the "Export" button opens the beautifully streamlined Export Modal, offering frictionless pipelines to any platform:

> [!TIP]
> **The Magic iOS Share Link**
> Apple restricts iPhones from natively importing local multi-event `.ics` files. SmartSync solves this brilliantly. Click **"Generate iOS Share Link"** to dynamically bundle your events, upload them to an ephemeral cloud server, and generate a 1-click install link. Text this link to any iPhone user, and Safari will instantly import the entire calendar bundle!

* **Download `.ics` File:** Instantly saves a native calendar file to your Downloads folder (silently, with zero annoying popups) for immediate import into Apple Calendar.
* **Push to Apple Reminders:** Bypasses browser limitations by utilizing a custom IPC bridge to execute native macOS AppleScript, injecting tasks directly into your Mac's Reminders app.
* **Google & Outlook Web:** 1-click buttons to open specific events directly in your browser's calendar composer.
* **Copy Formatted Text:** Generates a visually clean text summary. Perfect for pasting into iMessage, where iOS data detectors will automatically underline dates for easy tapping.

---

## 🎨 UI/UX & Attention to Detail

Every interaction in SmartSync was engineered to delight the user:

* **Dynamic Flashlight Cursor:** A subtle, radial gradient follows your mouse across the application, illuminating borders and surfaces to create a sense of depth.
* **Glassmorphism:** Modal overlays and headers utilize `backdrop-filter: blur(24px)` to beautifully refract the content beneath them.
* **Frictionless Window Management:** The entire top header is natively draggable (`-webkit-app-region: drag`), seamlessly integrating with the macOS window manager while carefully protecting interactive elements like the close button.
* **Micro-Animations:** Buttons gently scale on hover, lists stagger their entrance, and success states flash a satisfying green before smoothly reverting.

---

## 🚀 Getting Started

1. Open **SmartSync**.
2. Paste an itinerary, email, or chat log into the left panel.
3. Click **Extract Events**.
4. Review your generated Events and Todos on the right.
5. Click **Export** and choose your preferred pipeline.
6. Let SmartSync handle the rest.

---

*Made with passion by Aamir Alsufi.*
