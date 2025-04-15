from transformers import AutoProcessor, VitsModel
import torch
import soundfile as sf

processor = AutoProcessor.from_pretrained("facebook/mms-tts-tgl")
model = VitsModel.from_pretrained("facebook/mms-tts-tgl")

inputs = processor(text="Kamusta, ito ay isang paalala para sa iyo.", return_tensors="pt")

with torch.no_grad():
    # Use forward pass instead of generate()
    output = model(**inputs)

# Get the waveform from the output
speech = output.waveform

sample_rate = model.config.sampling_rate
sf.write("output.wav", speech.squeeze().numpy(), sample_rate)