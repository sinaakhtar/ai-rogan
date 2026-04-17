import os
from google import genai
from google.cloud import texttospeech
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def generate_script(text: str, style: str, prompt_template: str = None) -> str:
    """Generates a podcast script (dialogue) between two people using Gemini."""
    # The new Google GenAI SDK client configured for Vertex AI
    client = genai.Client(vertexai=True)
    
    default_prompt = f"""
    You are a podcast script generator. 
    Take the following source text and generate a podcast script out of it.
    The style should be: {style}.
    The output must always be a conversation between two people.
    You MUST use the speaker labels "speaker1:" and "speaker2:" exactly at the start of each line to indicate who is speaking.
    
    CRITICAL RULES:
    1. Do NOT use markdown bolding (like **speaker1:**) anywhere in the script. Use plain text labels like "speaker1:".
    2. Do NOT include any text descriptions of music, sound effects, or production cues (like "[Episode Intro Music]"). Only output the words to be spoken.
    3. Do NOT have the speakers address each other as "speaker1" or "speaker2" in the dialogue. They are labels for the TTS engine, not names.
    4. To make the podcast more interesting, you are encouraged to include expressive cues in the text, such as [laughs], [sigh], [giggles], [snickers], or [hesitation] where appropriate to make the conversation feel more natural and alive.
    
    Make it engaging, natural, and informative.
    
    Source Text:
    {text}
    """
    
    if prompt_template:
        prompt = prompt_template.replace("{style}", style).replace("{text}", text)
    else:
        prompt = default_prompt
        
    response = client.models.generate_content(
        model="gemini-3-flash-preview", # Switched to Gemini 3 Flash as requested
        contents=prompt,
    )
    return response.text

def generate_audio(script: str, output_filepath: str = "output.wav", speaker1_voice: str = "Kore", speaker2_voice: str = "Charon", task_state: dict = None) -> str:
    """Synthesizes speech from the script using Gemini-3.1-Flash-TTS-Preview with MultiSpeakerMarkup.
    Splits the script into chunks of turns to fit TTS limits and stitches them together.
    """
    from pydub import AudioSegment
    import io
    
    client = texttospeech.TextToSpeechClient()
    
    # The prompt here is for styling instructions to the TTS model
    prompt = "You are hosting a podcast. Speak in a natural, conversational tone."
    
    lines = [line for line in script.split('\n') if line.strip() and ':' in line]
    
    # Convert lines to turns
    turns = []
    for line in lines:
        speaker, text = line.split(':', 1)
        speaker = speaker.strip().replace(" ", "").lower()
        text = text.strip()
        if text:
            turns.append(texttospeech.MultiSpeakerMarkup.Turn(
                speaker=speaker,
                text=text
            ))
            
    combined_audio = AudioSegment.empty()
    
    # Config
    multi_speaker_voice_config = texttospeech.MultiSpeakerVoiceConfig(
        speaker_voice_configs=[
            texttospeech.MultispeakerPrebuiltVoice(
                speaker_alias="speaker1",
                speaker_id=speaker1_voice,
            ),
            texttospeech.MultispeakerPrebuiltVoice(
                speaker_alias="speaker2",
                speaker_id=speaker2_voice,
            ),
        ]
    )
    
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        model_name="gemini-3.1-flash-tts-preview",
        multi_speaker_voice_config=multi_speaker_voice_config,
    )
    
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=24000,
    )
    
    # Chunking by turns
    current_turns = []
    current_length = 0
    synthesized_turns = 0
    
    for i, turn in enumerate(turns):
        turn_len = len(turn.text.encode('utf-8'))
        
        # If adding this turn exceeds limit, process current chunk
        if current_length + turn_len > 4000:
            if current_turns:
                if task_state is not None:
                    task_state["logs"].append(f"Generating audio for chunk of {len(current_turns)} turns...")
                    # Set an intermediate progress for this chunk
                    task_state["progress"] = int((synthesized_turns + 0.5 * len(current_turns)) / len(turns) * 100)
                    
                synthesis_input = texttospeech.SynthesisInput(
                    multi_speaker_markup=texttospeech.MultiSpeakerMarkup(turns=current_turns),
                    prompt=prompt
                )
                
                try:
                    response = client.synthesize_speech(
                        input=synthesis_input, voice=voice, audio_config=audio_config
                    )
                    segment = AudioSegment.from_file(io.BytesIO(response.audio_content), format="wav")
                    combined_audio += segment
                    
                    synthesized_turns += len(current_turns)
                    if task_state is not None:
                        task_state["progress"] = int(synthesized_turns / len(turns) * 100)
                except Exception as e:
                    error_msg = f"Error generating audio for chunk: {e}"
                    print(error_msg)
                    if task_state is not None:
                        task_state["logs"].append(error_msg)
                        
            # Start new chunk
            current_turns = [turn]
            current_length = turn_len
        else:
            current_turns.append(turn)
            current_length += turn_len
            
    # Process last chunk
    if current_turns:
        if task_state is not None:
            task_state["logs"].append(f"Generating audio for last chunk of {len(current_turns)} turns...")
            # Set an intermediate progress for this chunk
            task_state["progress"] = int((synthesized_turns + 0.5 * len(current_turns)) / len(turns) * 100)
            
        synthesis_input = texttospeech.SynthesisInput(
            multi_speaker_markup=texttospeech.MultiSpeakerMarkup(turns=current_turns),
            prompt=prompt
        )
        
        try:
            response = client.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config
            )
            segment = AudioSegment.from_file(io.BytesIO(response.audio_content), format="wav")
            combined_audio += segment
            
            synthesized_turns += len(current_turns)
            if task_state is not None:
                task_state["progress"] = 100
        except Exception as e:
            error_msg = f"Error generating audio for last chunk: {e}"
            print(error_msg)
            if task_state is not None:
                task_state["logs"].append(error_msg)
                
    # Export
    combined_audio.export(output_filepath, format="wav")
    
    if task_state is not None:
        task_state["logs"].append("Audio generation completed.")
        
    return output_filepath
