import React, { useState, useEffect } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Ensure this is the correct import

// Set the workerSrc for pdfjs-dist
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

function App() {
  const [extractedText, setExtractedText] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [generatedQuestions, setGeneratedQuestions] = useState(''); // New state for generated questions

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recog = new SpeechRecognition();
      recog.lang = 'en-US';
      recog.interimResults = false;
      recog.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(transcript);
      };
      setRecognition(recog);
    } else {
      console.log('Speech recognition not supported');
    }
  }, []);

  const extractTextFromPDF = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        try {
          const pdf = await getDocument(typedarray).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            text += textContent.items.map((item) => item.str).join(' ');
          }
          resolve(text);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const extractTextFromWord = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function () {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: this.result });
          resolve(result.value);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    setError('');
    if (file) {
      const fileType = file.type;
      try {
        let text = '';
        if (fileType === 'application/pdf') {
          text = await extractTextFromPDF(file);
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          text = await extractTextFromWord(file);
        } else {
          setError('Unsupported file type');
          return;
        }
        setExtractedText(text);
        console.log(text);
        await generateQuestions(text); // Send text to AI and generate questions
      } catch (err) {
        setError('Error extracting text: ' + err.message);
      }
    }
  };

  const generateQuestions = async (text) => {
    setLoading(true);
    try {
      const genAI = new GoogleGenerativeAI('AIzaSyDhzjvyzgQSt2zHrUgNJYVpOZAWvPFkwSk'); // Replace with your API key
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Generate questions based on the following text:\n\n${text}`;
      const chat = model.startChat({
        history: messages.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
        generationConfig: {
          maxOutputTokens: 5000, // Adjust token count as needed
        },
      });

      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const responseText = await response.text();

      setMessages([...messages, { role: 'user', text: prompt }, { role: 'model', text: responseText }]);
      setGeneratedQuestions(responseText); // Set generated questions
    } catch (error) {
      setError('Error generating questions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (userInput.trim()) {
      fetchResponse(userInput);
      setUserInput(''); // Clear input after submission
    }
  };

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  const startRecognition = () => {
    if (recognition) {
      recognition.start();
    }
  };

  return (
    <div style={styles.container}>
      <h2>Upload PDF or Word Document</h2>
      <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} />
      {error && <p style={styles.error}>{error}</p>}
      {extractedText && (
        <div style={styles.textContainer}>
          <h3>Extracted Text:</h3>
          <p>{extractedText}</p>
        </div>
      )}
      {generatedQuestions && (
        <div style={styles.textContainer}>
          <h3>Generated Questions:</h3>
          <textarea
            value={generatedQuestions}
            readOnly
            rows={10}
            style={styles.textarea}
          />
        </div>
      )}
      <div style={styles.app}>
        <div style={styles.aiIcon} onClick={toggleChat}>
          🤖 {/* You can replace this with an actual icon or image */}
        </div>
        {showChat && (
          <header style={styles.header}>
            <div style={styles.chatContainer}>
              <h2 style={styles.chatHeader}>Personal Doctor</h2>
              <div style={styles.messages}>
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      ...styles.message,
                      ...(msg.role === 'user' ? styles.userMessage : styles.aiMessage),
                    }}
                  >
                    {msg.text}
                  </div>
                ))}
                {loading && <div style={{ ...styles.message, ...styles.aiMessage }}>Loading...</div>}
                {error && <div style={{ ...styles.message, ...styles.aiMessage, color: 'red' }}>{error}</div>}
              </div>
              <form onSubmit={handleSubmit} style={styles.inputForm}>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type a message..."
                  style={styles.inputField}
                />
                <button type="submit" style={styles.sendButton}>Send</button>
                <div
                  style={styles.speechIcon}
                  onClick={startRecognition}
                >
                  🎧 {/* Headset icon; you can use an SVG or Font Awesome icon */}
                </div>
              </form>
            </div>
          </header>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
  },
  error: {
    color: 'red',
  },
  textContainer: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#f4f4f4',
    borderRadius: '5px',
    whiteSpace: 'pre-wrap',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    marginTop: '10px',
    borderRadius: '5px',
    border: '1px solid #ddd',
    fontFamily: 'Arial, sans-serif',
    resize: 'none',
  },
  app: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
  },
  aiIcon: {
    fontSize: '2rem',
    cursor: 'pointer',
    textAlign: 'center',
  },
  header: {
    marginTop: '20px',
  },
  chatContainer: {
    backgroundColor: '#f4f4f4',
    borderRadius: '5px',
    padding: '10px',
    boxShadow: '0 0 10px rgba(0,0,0,0.1)',
  },
  chatHeader: {
    marginBottom: '10px',
  },
  messages: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  message: {
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '5px',
  },
  userMessage: {
    backgroundColor: '#e1f5fe',
    textAlign: 'left',
  },
  aiMessage: {
    backgroundColor: '#e8eaf6',
    textAlign: 'right',
  },
  inputForm: {
    display: 'flex',
    alignItems: 'center',
  },
  inputField: {
    flex: 1,
    padding: '10px',
    marginRight: '10px',
  },
  sendButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  speechIcon: {
    fontSize: '1.5rem',
    cursor: 'pointer',
    marginLeft: '10px',
  },
};

export default App;
