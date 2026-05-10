from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key = os.getenv("DEEPSEEK_API_KEY"),
    base_url = "https://api.deepseek.com"
)

# 聊天记录（临时内存）
chat_history = []

def ask_ai(question):
    # 将用户消息添加到历史聊天中
    chat_history.append(
        {"role": "user",
         "content": question})
    
    response = client.chat.completions.create(
        model = "deepseek-v4-flash",
        messages = chat_history
    )

    answer = response.choices[0].message.content

    # 将AI回复加入历史聊天中
    chat_history.append(
        {
            "role": "assistant",
            "content": answer
        }
    )

    return answer