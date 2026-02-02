import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# Basic survey generation output
def generate_survey_text(topic=None):

    load_dotenv()
    # Get API key from environment variable
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")

    client = OpenAI(api_key=api_key)

    if topic is None:
        topic = "Stockton, CA and their residents' opinions on the city's crime rate."
    
    response = client.responses.create(
        model="gpt-5.2",
        input=f"""
        You are a survey generation assistant. 
        You will be given a topic and you will need to generate 5,
        non-biased survey questions that are appropriate for the topic.
        TOPIC: {topic}
        """
    )

    return response.output_text

if __name__ == "__main__":
    # Survey Output TODO: Implement pipeline for users to generate a topic of their choosing
    survey_text = generate_survey_text()
    print(survey_text)
