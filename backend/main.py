from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
import uuid
from ingestor import extract_text
from generator import generate_script, generate_audio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for combined text (simplification for demo)
state = {"combined_text": ""}

# In-memory storage for task states
tasks_state = {}

class ScriptRequest(BaseModel):
    style: str
    prompt_template: str = None

class AudioRequest(BaseModel):
    script: str
    speaker1_voice: str = "Kore"
    speaker2_voice: str = "Charon"

@app.post("/upload")
async def upload_documents(files: list[UploadFile] = File(...)):
    temp_dir = "temp_docs"
    os.makedirs(temp_dir, exist_ok=True)
    
    combined_text = ""
    for file in files:
        file_path = os.path.join(temp_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        try:
            text = extract_text(file_path)
            combined_text += text + "\n"
        except Exception as e:
            # Clean up in case of error
            shutil.rmtree(temp_dir)
            return JSONResponse(status_code=500, content={"message": f"Error processing {file.filename}: {str(e)}"})
            
    shutil.rmtree(temp_dir)
    state["combined_text"] = combined_text
    
    return {"message": "Documents processed successfully. Please select a style.", "text_length": len(combined_text)}

@app.post("/generate_script")
async def generate_podcast_script(request: ScriptRequest):
    if not state["combined_text"]:
        return JSONResponse(status_code=400, content={"message": "No documents uploaded yet."})
        
    try:
        script = generate_script(state["combined_text"], request.style, prompt_template=request.prompt_template)
        return {"script": script}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": f"Error generating script: {str(e)}"})

def bg_generate_audio(task_id: str, script: str, speaker1_voice: str, speaker2_voice: str):
    """Background task for audio generation."""
    output_audio_path = f"podcast_{task_id}.wav"
    try:
        generate_audio(script, output_audio_path, speaker1_voice=speaker1_voice, speaker2_voice=speaker2_voice, task_state=tasks_state[task_id])
        tasks_state[task_id]["status"] = "completed"
        tasks_state[task_id]["audio_path"] = output_audio_path
    except Exception as e:
        tasks_state[task_id]["status"] = "failed"
        tasks_state[task_id]["logs"].append(f"Failed: {str(e)}")

@app.post("/generate_audio")
async def generate_podcast_audio(request: AudioRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    tasks_state[task_id] = {
        "progress": 0,
        "logs": ["Starting audio generation..."],
        "status": "in_progress"
    }
    
    background_tasks.add_task(
        bg_generate_audio, 
        task_id, 
        request.script, 
        request.speaker1_voice, 
        request.speaker2_voice
    )
    
    return {"task_id": task_id, "message": "Audio generation started."}

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    if task_id not in tasks_state:
        return JSONResponse(status_code=404, content={"message": "Task not found."})
    return tasks_state[task_id]

@app.get("/download/{task_id}")
async def download_audio(task_id: str):
    if task_id not in tasks_state:
        return JSONResponse(status_code=404, content={"message": "Task not found."})
        
    state = tasks_state[task_id]
    if state["status"] != "completed":
        return JSONResponse(status_code=400, content={"message": "Task not completed yet."})
        
    audio_path = state.get("audio_path")
    if not audio_path or not os.path.exists(audio_path):
        return JSONResponse(status_code=404, content={"message": "Audio file not found."})
        
    return FileResponse(audio_path, media_type="audio/wav", filename="podcast.wav")
