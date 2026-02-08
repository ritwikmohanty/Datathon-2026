"""
Business Insights Engine
Processes queries and generates intelligent responses using LLM
"""

from typing import Dict, Any, Optional
import os
import google.generativeai as genai

class InsightsEngine:
    def __init__(self, mongodb_service):
        self.mongodb = mongodb_service
        
        # Configure Gemini
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        # Use gemini-1.5-flash instead of gemini-pro (deprecated)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Load system prompt
        self.system_prompt = self._load_system_prompt()
    
    def _load_system_prompt(self) -> str:
        """Load system prompt for AI"""
        return """You are an AI Business Insights Assistant for a software development team.

You have access to comprehensive data from:
1. Jira tickets (tasks, status, assignees, deadlines)
2. GitHub commits (contributors, lines of code, files changed)
3. Team members: Aryan (AWS Solutions Architect), Ritwik (AWS Backend Developer), Mohak (AWS DevOps Engineer), Manu (AWS Cloud Engineer)
4. Project timelines and sprints

Your role:
- Provide clear, concise business insights
- Speak in a friendly, professional Indian English tone
- Highlight important metrics and trends
- Offer actionable recommendations
- Keep responses under 30 seconds when spoken (around 100-150 words)

Response Format:
1. Acknowledge the question briefly
2. Provide 2-3 key data points
3. Offer one insight or recommendation
4. End with a positive encouraging note

Always be helpful, accurate, and encouraging!"""
    
    def process_query(self, query: str, language: str = 'en') -> str:
        """
        Process user query and generate response
        
        Args:
            query: User's question
            language: Language code (en or hi)
        
        Returns:
            Generated response text
        """
        try:
            # Detect query type and fetch relevant data
            context = self._gather_context(query)
            
            # Generate response using LLM
            response = self._generate_response(query, context, language)
            
            return response
        except Exception as e:
            print(f"Error processing query: {e}")
            return self._get_fallback_response(language)
    
    def _gather_context(self, query: str) -> Dict[str, Any]:
        """Gather relevant context based on query"""
        context = {}
        query_lower = query.lower()
        
        # Detect query type and fetch data
        if any(name in query_lower for name in ['aryan', 'ritwik', 'mohak', 'manu']):
            # Individual status query
            for name in ['Aryan', 'Ritwik', 'Mohak', 'Manu']:
                if name.lower() in query_lower:
                    context['user_status'] = self.mongodb.get_user_status(name)
                    context['individual_contribution'] = self.mongodb.get_individual_contribution(name)
                    break
        
        if any(word in query_lower for word in ['team', 'everyone', 'all', 'performance']):
            # Team performance query
            context['team_performance'] = self.mongodb.get_team_performance()
        
        if any(word in query_lower for word in ['project', 'deadline', 'track', 'health', 'sprint']):
            # Project health query
            context['project_health'] = self.mongodb.get_project_health()
        
        if any(word in query_lower for word in ['blocker', 'issue', 'problem', 'stuck']):
            # Blockers query
            context['blockers'] = self.mongodb.get_blockers()
        
        # If no specific context, get general overview
        if not context:
            context['team_performance'] = self.mongodb.get_team_performance()
            context['project_health'] = self.mongodb.get_project_health()
        
        return context
    
    def _generate_response(self, query: str, context: Dict[str, Any], language: str) -> str:
        """Generate response using Gemini"""
        try:
            # Build context message
            context_str = f"User Query: {query}\n\nAvailable Data:\n"
            for key, value in context.items():
                context_str += f"\n{key}:\n{str(value)[:500]}\n"  # Limit context size
            
            # Combine system prompt with user query
            full_prompt = f"{self.system_prompt}\n\n{context_str}"
            
            # Generate response with Gemini
            response = self.model.generate_content(
                full_prompt,
                generation_config={
                    'temperature': 0.7,
                    'max_output_tokens': 200,
                }
            )
            
            return response.text.strip()
        except Exception as e:
            print(f"Gemini Error: {e}")
            return self._get_fallback_response(language)
    
    def _get_fallback_response(self, language: str) -> str:
        """Get fallback response when LLM fails"""
        if language == 'hi':
            return "माफ़ कीजिये, मुझे आपकी query process करने में problem हो रही है। कृपया दोबारा try करें।"
        else:
            return "I'm sorry, I'm having trouble processing your query. Please try again."
    
    def get_introduction(self, language: str = 'en') -> str:
        """Get introduction message"""
        if language == 'hi':
            return """नमस्ते! मैं आपकी AI Business Insights Assistant हूं। 
मैं आपकी team के Jira tickets, GitHub commits, और project status के बारे में जानकारी दे सकती हूं।
आप मुझसे कुछ भी पूछ सकते हैं जैसे कि team का performance, किसी का status, या project की health।
मैं यहाँ आपकी मदद के लिए हूं!"""
        else:
            return """Hello! I'm your AI Business Insights Assistant. 
I can provide information about your team's Jira tickets, GitHub commits, and project status.
You can ask me about team performance, individual status, project health, or any blockers.
How can I help you today?"""


# Test function
if __name__ == '__main__':
    from dotenv import load_dotenv
    from mongodb_service import MongoDBService
    
    load_dotenv()
    
    mongodb = MongoDBService()
    engine = InsightsEngine(mongodb)
    
    print("Testing Insights Engine...")
    
    # Test queries
    test_queries = [
        "What is Aryan working on?",
        "How is the team performing?",
        "Are we on track for the deadline?"
    ]
    
    for query in test_queries:
        print(f"\nQuery: {query}")
        response = engine.process_query(query)
        print(f"Response: {response}")
    
    mongodb.close()
    print("\n✅ Insights Engine Test Complete")
