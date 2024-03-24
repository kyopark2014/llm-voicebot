# 음성 챗봇 만들기

여기서는 음성 텍스트 변환(Speech-to-Text), LLM(Large Language Model), 텍스트 음성 변환 (Text-to-Speech)를 통해 음섬 챗봇 (voicebot)을 만드는것을 설명합니다.

<img src="main-architecture.png" width="800">

## Speech-to-Text

Amazon Transcribe를 이용해 실시간으로 음성을 텍스트로 변환합니다.

## LLM

## Text-to-Speech

Amazon Polly를 이용해 텍스트를 음성으로 변환합니다. 이때 시간지연이 없도록 파일이 아닌 음성데이터를 이용하여 변환 및 음성 송출을 수행합니다. 
