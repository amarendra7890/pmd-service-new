import { LightningElement, track, api } from 'lwc';

export default class RAssistChatBotInput extends LightningElement {
    @track transcribedText = '';
    @api isDictating = false;
    @track input = '';
    recognition;

    handleChange(event) {
        console.log('Change: ' + event.target.value);
        this.input = event.target.value;
    }

    handleKeyPress(event) {
        console.log('KeyPress: ' + event.target.value);
        if (event.key === 'Enter') {
            console.log('KeyPress1: ' + event.target.value);

            this.send();
        }
    }

    send() {
        console.log('KeyPress2: ' + this.input);
        if (!this.input.trim()) return;
        console.log('KeyPress3: ' + this.input);

        this.dispatchEvent(new CustomEvent('usermessage', { detail: this.input }));
        console.log('KeyPress4: ' + this.input);

        this.input = '';

    }
    startDictation() {
        this.isDictating = true;
        console.log('Dictation started');
        this.recognition.start();
    }
    stopDictation() {
        this.isDictating = false;
        console.log('Dictation stopped');
        this.recognition.stop();
    }

    connectedCallback() {
        // const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        // if (SpeechRecognition) {
        //     this.recognition = new SpeechRecognition();
        //     this.recognition.continuous = true;
        //     this.recognition.interimResults = false;
        //     this.recognition.lang = 'en-US';

        //     this.recognition.onresult = (event) => {
        //         let transcript = '';
        //         for (let i = event.resultIndex; i < event.results.length; ++i) {
        //             transcript += event.results[i][0].transcript;
        //         }
        //         this.input += transcript + ' ';
        //     };

        //     this.recognition.onerror = (event) => {
        //         console.error('Speech recognition error:', event.error);
        //         this.isDictating = false;
        //     };

        //     this.recognition.onend = () => {
        //         console.log('Speech recognition ended');
        //         console.log('Transcribed Text: ' + this.input);

        //         this.isDictating = false;
        //     };
        // } else {
        //     alert('Speech Recognition not supported in this browser.');
        // }
    }
}