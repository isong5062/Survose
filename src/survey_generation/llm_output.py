import os
from dotenv import load_dotenv
from openai import OpenAI

# Basic survey generation output
def generate_survey_text(topic=None):
    """
    Generate a survey text based on the topic
    """

    load_dotenv()
    # Get API key from environment variable
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")

    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)

    if topic is None:
        topic = """Stockton, CA and their residents' 
        opinions on the city's crime rate."""

    # Generate survey text
    response = client.responses.create(
        model="gpt-5.2",
        input=f"""
        You are a survey generation assistant.
        You will be given a topic and you will need to generate 1,
        non-biased survey questions that are appropriate for the topic.
        Keep the question minimal and brief.
        Do not include any other text in your response.
        TOPIC: {topic}
        """
    )

    # Return text output that will be converted to speech
    return response.output_text
