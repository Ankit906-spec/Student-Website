# User Testing Session Guide

## 🎯 Quick Reference for Facilitators

This guide helps you run smooth user testing sessions for the Design Thinking final project.

---

## Pre-Session Setup (5 minutes)

### ✅ Checklist
- [ ] Backend server running (`cd Backend && npm start`)
- [ ] Testing dashboard open in browser (`testing-dashboard.html`)
- [ ] Test session starter ready (`test-session-starter.html`)
- [ ] Think-aloud template open for notes
- [ ] Recording device ready (optional)
- [ ] Quiet testing environment secured

### 📋 Materials Needed
1. Computer with browser
2. Notepad/laptop for facilitator notes
3. Printed task list (optional)
4. Consent form signed
5. Timer/stopwatch
6. Water for participant

---

## Session Flow (30-40 minutes total)

### Phase 1: Welcome & Setup (5 min)

**Script:**
> "Thank you for participating in our usability test. Today you'll help us improve the Student Portal platform. Remember, we're testing the portal, not you—there are no wrong answers.
>
> I'll ask you to complete some tasks while thinking out loud. That means tell me what you're looking at, what you're trying to do, and how you're feeling. If something confuses you, that's exactly what we need to know.
>
> Do you have any questions before we begin?"

**Actions:**
1. Open `test-session-starter.html`
2. Help participant fill in information
3. Note their Session ID when generated
4. Explain think-aloud technique with example

**Example Think-Aloud Demo:**
> "For example, if I'm looking for the save button, I might say: 'I need to save this, so I'm looking for a save button. I see several buttons here. The green one says Submit—that's probably it. Let me click it.'"

---

### Phase 2: Testing Tasks (20-25 min)

**For Each Task:**
1. Read task aloud
2. Start timer
3. Let participant work independently
4. Take notes on:
   - What they say (verbatim quotes)
   - What they do (navigation path)
   - Where they hesitate
   - Any errors or confusion
5. Stop timer when complete (or at 3 min max)
6. Ask follow-up if stuck: "What are you thinking right now?"

#### Task 1: Login & Explore (3 min)
**Instruction:** "Please log in to the Student Portal and explore the main dashboard."

**What to Watch:**
- Can they find login fields easily?
- Do they understand the navigation?
- Do they explore multiple sections?

**Success Criteria:**
- ✅ Successfully logged in
- ✅ Clicked at least 2 navigation items
- ✅ Understood dashboard layout

**Notes Template:**
```
Time: ___ seconds
Path: Login → ___________ → ___________
Quotes: "________________________________"
Issues: _________________________________
Success: Yes / Partial / No
```

---

#### Task 2: Find & View Course (3 min)
**Instruction:** "Find a course you're interested in and view its details."

**What to Watch:**
- Navigation to courses section
- Search/browse behavior
- Understanding of course cards

**Success Criteria:**
- ✅ Found courses section
- ✅ Selected a course
- ✅ Viewed course details

---

#### Task 3: Assignment Submission (5 min)
**Instruction:** "Locate an assignment and try to submit work for it."

**What to Watch:**
- Can they find assignments?
- Upload process clarity
- Form completion

**Success Criteria:**
- ✅ Found assignments section
- ✅ Selected an assignment
- ✅ Understood submission process
- ✅ (Optional) Completed submission

**Common Issues to Note:**
- Confusion about file upload
- Not finding submit button
- Unclear instructions

---

#### Task 4: Discussion Board (3 min)
**Instruction:** "Check the messages in one of your courses."

**What to Watch:**
- Finding discussion/messages section
- Understanding message organization
- Interaction patterns

**Success Criteria:**
- ✅ Found messages section
- ✅ Selected a course
- ✅ Viewed messages

---

#### Task 5: Update Profile (3 min)
**Instruction:** "Update your profile information."

**What to Watch:**
- Locating profile section
- Form usability
- Save process

**Success Criteria:**
- ✅ Found profile section
- ✅ Made a change
- ✅ Saved successfully

---

### Phase 3: Post-Test Questions (5-10 min)

**Ask these questions:**

1. **Overall Impression**
   - "On a scale of 1-5, how would you rate your overall experience?"
   - "What did you like most about the portal?"
   - "What frustrated you the most?"

2. **Specific Features**
   - "Which feature was easiest to use?"
   - "Which feature was most confusing?"
   - "What would you change if you could?"

3. **System Usability Scale (SUS)**
   Read each statement, participant rates 1-5 (Strongly Disagree to Strongly Agree):
   - [ ] I think I would like to use this system frequently
   - [ ] I found the system unnecessarily complex
   - [ ] I thought the system was easy to use
   - [ ] I would need support to use this system
   - [ ] I found the various functions well integrated
   - [ ] There was too much inconsistency in the system
   - [ ] Others would learn this system quickly
   - [ ] I found the system very cumbersome to use
   - [ ] I felt very confident using the system
   - [ ] I needed to learn a lot before I could use the system

**SUS Score Calculation:**
- Odd items: (rating - 1)
- Even items: (5 - rating)
- Sum all, multiply by 2.5
- Score: ___ / 100

---

## During the Session

### ✅ DO's
- ✅ Encourage continuous verbalization
- ✅ Stay neutral in body language and tone
- ✅ Take detailed notes on observations
- ✅ Track time per task
- ✅ Note exact quotes (especially frustration/delight)
- ✅ Monitor analytics dashboard occasionally

### ❌ DON'Ts
- ❌ Lead or guide the participant
- ❌ Answer questions about the interface
- ❌ Show frustration if they struggle
- ❌ Interrupt their workflow
- ❌ Say "that's correct" or "good job"

### Neutral Prompts (if participant goes silent)
- "What are you thinking right now?"
- "Can you tell me what you're looking at?"
- "What do you expect will happen when you click that?"
- "How are you feeling about this task?"

---

## After the Session

### Immediate Actions (5 min)
1. **Thank Participant**
   > "Thank you so much! Your feedback is incredibly valuable and will directly improve the portal."

2. **Note Session ID**: `____________________`

3. **Save Notes** immediately to think-aloud template

4. **Check Analytics Dashboard**
   - Verify session appears
   - Note event count
   - Check for any unexpected patterns

### Data Collection (10 min)
1. Export session data from dashboard
2. Fill in `testing_data_log.md` template with:
   - Task completion rates
   - Time per task
   - Number of clicks
   - Observed issues
3. Complete participant section in `think_aloud_template.md`

### Debrief (5 min)
1. Review notes while fresh in mind
2. Identify top 3 insights
3. Note any critical issues for immediate attention
4. Prepare for next session

---

## Between Sessions

- [ ] Review previous session notes
- [ ] Check if any critical bugs need fixing
- [ ] Ensure test environment is reset
- [ ] Prepare for next participant
- [ ] Update documentation with new insights

---

## Emergency Situations

### "The portal crashed"
1. Stay calm, reassure participant
2. Note the exact action that caused crash
3. Check server logs
4. Restart backend if needed
5. Document as critical issue

### "I can't figure this out"
**After 3 minutes of struggle:**
> "Let's move on to the next task. Your difficulty finding this is exactly what we needed to learn."

**Document:**
- What they were trying to do
- Where they looked
- Why they couldn't find it

### "This is terrible design"
**Stay neutral, probe deeper:**
> "That's valuable feedback. Can you tell me more about what makes it difficult?"

---

## Session Checklist Summary

### Before
- [ ] Server running
- [ ] Dashboard open
- [ ] Session starter ready
- [ ] Documentation ready

### During  
- [ ] Session ID recorded
- [ ] All 5 tasks attempted
- [ ] Think-aloud encouraged
- [ ] Notes taken
- [ ] SUS questionnaire completed

### After
- [ ] Thank participant
- [ ] Export analytics data
- [ ] Fill documentation templates
- [ ] Review insights
- [ ] Prepare for next session

---

## Quick Metrics Reference

### Target Benchmarks
- **Task Completion Rate**: >85%
- **Average Task Time**: <2 minutes each
- **SUS Score**: >68 (above average)
- **Satisfaction**: >3.5/5

### Red Flags to Watch
- ⚠️ Completion rate <70%
- ⚠️ Any task taking >5 minutes
- ⚠️ SUS score <50
- ⚠️ Multiple users stuck on same feature
- ⚠️ Frustration expressed repeatedly

---

## Sample Session Timeline

| Time | Activity |
|------|----------|
| 0:00 | Welcome & Setup |
| 0:05 | Task 1: Login & Explore |
| 0:08 | Task 2: Find Course |
| 0:11 | Task 3: Assignment |
| 0:16 | Task 4: Messages |
| 0:19 | Task 5: Profile |
| 0:22 | Post-test Questions |
| 0:27 | SUS Questionnaire |
| 0:32 | Thank & Wrap Up |
| 0:35 | Session Complete |

---

## Tips for Success

1. **Record Everything**: You can't take too many notes
2. **Stay Neutral**: Your poker face is critical
3. **Listen More, Talk Less**: Let participants struggle (it's data!)
4. **Ask Why**: "Why did you click that?" reveals mental models
5. **Watch Behavior**: Actions speak louder than words
6. **Compare Sessions**: Patterns emerge across multiple users

---

**Remember**: Every confused click, every frustrated sigh, every delighted "oh!" is valuable data helping us improve the portal!

**Good luck with your testing sessions!** 🎉
