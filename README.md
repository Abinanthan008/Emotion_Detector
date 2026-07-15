# Cross-Speaker Speech Emotion Recognition (SER) with React Frontend

A full-stack, hybrid application featuring an advanced Audio Emotion Recognition deep learning pipeline on the backend, paired with an interactive, modern React + Vite frontend styled via Tailwind CSS. 

By leveraging intermediate representation hidden states from Facebook's pre-trained *HuBERT* model, the system circumvents "voice profiling" (speaker-identity overfitting) to achieve a *78.75% validation accuracy* on completely unseen human voices.

---

## ─── PROJECT ARCHITECTURE ───

The project is structured into a heavy audio-to-tensor feature extraction phase, a highly regularized temporal sequence classifier, and a decoupled user interface layer

## HOW TO RUN THIS PROJECT

THis project requires python 3.11.0 version and then do as follows
# Install python 3.11.0 version.
# Create virtual environment using "py3.11 -m venv env" and activate it.
# Install required packages using "pip install -r requirements.txt".
# Start the server using "uvicorn server:app --reload".
# Start the frontend in Emotion_Detector folder using "npm run dev".
# Go to the link and upload the audio file and predict the emotion.
