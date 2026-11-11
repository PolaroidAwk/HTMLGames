# Contributing to Fallout 2 Web Client

First off, thank you for considering contributing to the Fallout 2 Web Client! It's people like you that make the open-source community such an amazing place to learn, inspire, and create.

This document provides guidelines and instructions for contributing to this project.

---

## 🛠️ Code of Conduct

By participating in this project, you are expected to uphold a welcoming and professional environment:
* Be respectful and constructive in issues and pull requests.
* Maintain clean, readable, and well-commented code.
* **CRITICAL:** Do not commit or distribute copyrighted Fallout 2 game assets (`.dat` files) to this repository under any circumstances.

---

## 🚀 How to Contribute

### 1. Reporting Bugs
If you find a bug or experience an issue:
* Check the existing issues to ensure it hasn't been reported yet.
* Open a new issue with a clear title and description.
* Include detailed steps to reproduce the bug.
* Provide screenshots or console logs if applicable.

### 2. Suggesting Enhancements
Feature requests are highly encouraged!
* Open an issue explaining the feature and why it would be beneficial.
* Describe the expected behavior or implementation details if you have them.

### 3. Submitting Pull Requests
To submit a code change:
1. **Fork** the repository to your own GitHub account.
2. **Clone** your fork locally and navigate to the project directory.
3. **Create a branch** for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** and test them locally using a web server (e.g., `python -m http.server 8081`).
5. **Commit your changes** with clear, descriptive, and conventional commit messages (e.g., `feat: optimize rendering`, `fix: resolve audio stutter`).
6. **Push** your branch to your fork.
7. **Submit a Pull Request** to the `main` branch of this repository.

---

## 🎨 Development & Style Guide

* **Vanilla Stack:** This project explicitly avoids heavy frontend frameworks to keep the footprint small. Use standard HTML5, vanilla CSS, and clean JavaScript.
* **Performance First:** The WebAssembly runtime requires significant resources. Avoid layout thrashing, use `requestAnimationFrame` for UI updates, and optimize your JavaScript to be as lightweight as possible.
* **Responsive Design:** Ensure the canvas and UI scale gracefully across different window sizes and aspect ratios.

Thank you for contributing!
